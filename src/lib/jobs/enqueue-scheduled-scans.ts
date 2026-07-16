/**
 * Discover scheduled scan_batches created by process_due_scheduled_scans()
 * and enqueue them through the platform queue (org + idempotency + BullMQ).
 */

import { createServiceClient } from "@/lib/db/client";
import { enqueueMapsScanJob } from "@/lib/queue/service";
import { logger } from "@/lib/observability/logger";

export async function enqueueDueScheduledScanBatches(limit = 20): Promise<number> {
  const supabase = createServiceClient();
  const { data: batches } = await supabase
    .from("scan_batches")
    .select("id, business_id, confidence_summary, created_at")
    .eq("status", "queued")
    .order("created_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 50));

  if (!batches?.length) return 0;

  let enqueued = 0;
  for (const batch of batches) {
    const conf = (batch.confidence_summary ?? {}) as { scheduled?: boolean };
    if (!conf.scheduled) continue;

    const businessId = String(batch.business_id);
    const { data: biz } = await supabase
      .from("businesses")
      .select("organization_id, is_tracked")
      .eq("id", businessId)
      .maybeSingle();
    const organizationId = biz?.organization_id as string | undefined;
    if (!organizationId) {
      logger.warn("scheduled_scan_missing_org", { scanBatchId: batch.id, businessId });
      continue;
    }
    if (biz?.is_tracked === false) {
      await supabase
        .from("scan_batches")
        .update({
          status: "failed",
          error_message: "Business is not tracked — scheduled scan skipped",
          finished_at: new Date().toISOString(),
        })
        .eq("id", batch.id)
        .eq("status", "queued");
      continue;
    }

    try {
      const result = await enqueueMapsScanJob({
        scanBatchId: String(batch.id),
        businessId,
        organizationId,
        priority: "normal",
      });
      if (result.enqueueState === "enqueued" || result.reused) enqueued++;
    } catch (err) {
      logger.warn("scheduled_scan_enqueue_failed", {
        scanBatchId: batch.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  return enqueued;
}
