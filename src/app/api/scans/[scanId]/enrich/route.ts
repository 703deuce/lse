import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { requireScanAccess } from "@/lib/auth/api-auth";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const access = await requireScanAccess(scanId);
    const supabase = createServiceClient();

    const { data: batch } = await supabase
      .from("scan_batches")
      .select("id, status, enrichment_status")
      .eq("id", scanId)
      .single();
    if (!batch) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

    if (batch.status === "failed") {
      return NextResponse.json({ error: "Scan failed — rerun the grid scan first" }, { status: 400 });
    }

    if (batch.status === "ready" || batch.status === "partial") {
      return NextResponse.json({ ok: true, message: "Scan already fully enriched" });
    }

    if (!["rank_ready", "enriching", "scoring", "ai_planning"].includes(String(batch.status))) {
      return NextResponse.json({ error: "Scan is not rank-ready yet" }, { status: 400 });
    }

    if (batch.enrichment_status === "running") {
      return NextResponse.json({ ok: true, message: "Enrichment already running" });
    }

    const job = await dispatchFeatureJob({
      jobType: "scan_enrichment",
      payload: {
        scanBatchId: scanId,
        organizationId: access.organizationId,
        businessId: access.businessId,
      },
      organizationId: access.organizationId,
      businessId: access.businessId,
      idempotencyKey: `scan-enrichment:${scanId}`,
      priority: "normal",
      maxAttempts: 2,
    });

    return NextResponse.json({
      ok: true,
      queued: true,
      jobId: job.jobId,
      message: "Enrichment queued",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Enrichment trigger failed";
    const status = message.includes("access denied") || message.includes("not found") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
