import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { createServiceClient } from "@/lib/db/client";
import { dispatchScanProcessing } from "@/lib/jobs/schedule-scan";
import { requireScanAccess } from "@/lib/auth/api-auth";
import {
  gridMapCredits,
  PlanLimitError,
  releaseUsage,
  reserveUsageOrThrow,
} from "@/lib/plans";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    const access = await requireScanAccess(scanId);
    const supabase = createServiceClient();

    const { data: existing } = await supabase.from("scan_batches").select("*").eq("id", scanId).single();
    if (!existing) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

    const gridSize = typeof existing.grid_size === "number" ? existing.grid_size : 7;
    const creditsNeeded = gridMapCredits(gridSize);
    await reserveUsageOrThrow(access.organizationId, "map_credits_used", creditsNeeded);

    try {
      // Preserve center, location, keyword scope, and device profile — otherwise
      // processScanBatch falls back to business center + all keywords.
      const { data: batch, error } = await supabase
        .from("scan_batches")
        .insert({
          business_id: existing.business_id,
          status: "queued",
          scan_type: existing.scan_type ?? "quick",
          grid_size: existing.grid_size,
          radius_meters: existing.radius_meters,
          device: existing.device,
          os: existing.os,
          browser: (existing as { browser?: string }).browser ?? "chrome",
          provider: existing.provider,
          location_id: existing.location_id ?? null,
          center_lat: existing.center_lat ?? null,
          center_lng: existing.center_lng ?? null,
          center_label: existing.center_label ?? null,
          moved_from_scan_id: existing.id,
          confidence_summary: existing.confidence_summary ?? {},
        })
        .select("*")
        .single();

      if (error || !batch) {
        await releaseUsage(access.organizationId, "map_credits_used", creditsNeeded).catch(() => {});
        return NextResponse.json({ error: error?.message ?? "Rerun failed" }, { status: 500 });
      }

      const dispatched = await dispatchScanProcessing({
        scanBatchId: batch.id,
        businessId: String(existing.business_id),
        organizationId: access.organizationId,
      });

      return NextResponse.json({ scan: batch, jobId: dispatched.jobId, queueDriver: dispatched.driver });
    } catch (inner) {
      await releaseUsage(access.organizationId, "map_credits_used", creditsNeeded).catch(() => {});
      throw inner;
    }
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    return httpErrorFromException(err, "Rerun failed");
  }
}
