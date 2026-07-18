import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import {
  artifactIdentityKey,
  brandingVersionFromWhiteLabel,
  createSignedArtifactUrl,
  findReadyArtifact,
} from "@/lib/reporting/artifacts";
import { buildSingleScanReport } from "@/lib/reporting/build-single-scan";
import {
  REPORT_ARTIFACT_KINDS,
  type CompetitorLimit,
  type ReportArtifactKind,
} from "@/lib/reporting/pdf/constants";
import { createServiceClient } from "@/lib/db/client";
import { z } from "zod";

const bodySchema = z.object({
  businessId: z.string().uuid(),
  scanBatchId: z.string().uuid(),
  kind: z.enum(REPORT_ARTIFACT_KINDS),
  competitorLimit: z.union([z.literal(10), z.literal(20), z.literal("all")]).optional(),
  force: z.boolean().optional(),
});

/**
 * Create or reuse a scan export artifact (PDF / map / heatmap / CSV).
 * Heavy work runs on report-generation queue; ready artifacts return a signed URL.
 */
export async function POST(request: Request) {
  try {
    const json = await request.json();
    const parsed = bodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const { businessId, scanBatchId, kind, competitorLimit, force } = parsed.data;
    const auth = await requireBusinessAccess(businessId);
    await requireOrganizationPermission("report.create", auth.organizationId);

    const supabase = createServiceClient();
    const { data: batch } = await supabase
      .from("scan_batches")
      .select("id, business_id, status, finished_at, updated_at, created_at")
      .eq("id", scanBatchId)
      .maybeSingle();
    if (!batch || batch.business_id !== businessId) {
      return NextResponse.json({ error: "Scan not found" }, { status: 404 });
    }

    // Lightweight branding/data versions for cache key (avoid full report build when cached).
    let brandingVersion = "default";
    let dataVersion = String(batch.finished_at ?? batch.updated_at ?? batch.created_at);
    try {
      const payload = await buildSingleScanReport({ businessId, scanBatchId });
      brandingVersion = brandingVersionFromWhiteLabel(payload.whiteLabel);
      dataVersion = payload.parameters.scannedAt;
    } catch {
      /* identity still usable with defaults */
    }

    const identityKey = artifactIdentityKey({
      kind: kind as ReportArtifactKind,
      scanBatchId,
      competitorLimit: (competitorLimit ?? 20) as CompetitorLimit,
      brandingVersion,
      dataVersion,
    });

    if (!force) {
      const ready = await findReadyArtifact({ businessId, identityKey });
      if (ready?.storagePath) {
        const signedUrl = await createSignedArtifactUrl({ path: ready.storagePath });
        return NextResponse.json({
          queued: false,
          reused: true,
          reportId: ready.id,
          kind,
          downloadUrl: signedUrl,
          downloadPath: `/api/reports/artifacts/${ready.id}/download`,
        });
      }
    }

    const { dispatchFeatureJob } = await import("@/lib/queue/dispatch");
    const job = await dispatchFeatureJob({
      jobType: "generate_report",
      payload: {
        businessId,
        organizationId: auth.organizationId,
        scanBatchId,
        reportType: "single_scan",
        artifactKind: kind,
        competitorLimit: competitorLimit ?? 20,
        force: Boolean(force),
        persist: false,
      },
      organizationId: auth.organizationId,
      businessId,
      relatedResourceId: scanBatchId,
      idempotencyKey: `artifact:${identityKey}:${force ? Date.now() : "v1"}`,
      priority: "normal",
      maxAttempts: 3,
    });

    if (job.enqueueState === "enqueue_failed") {
      // Sync fallback so exports still work if the report worker is down.
      const { generateScanArtifact } = await import(
        "@/lib/reporting/pdf/generate-scan-artifacts"
      );
      const result = await generateScanArtifact({
        businessId,
        scanBatchId,
        kind: kind as ReportArtifactKind,
        competitorLimit: (competitorLimit ?? 20) as CompetitorLimit,
        force,
      });
      const signedUrl = await createSignedArtifactUrl({ path: result.storagePath });
      return NextResponse.json({
        queued: false,
        reused: result.reused,
        reportId: result.reportId,
        kind,
        downloadUrl: signedUrl,
        downloadPath: result.downloadPath,
        fallback: "sync",
      });
    }

    return NextResponse.json({
      queued: true,
      jobId: job.jobId,
      kind,
      identityKey,
    });
  } catch (err) {
    return httpErrorFromException(err, "Artifact request failed");
  }
}
