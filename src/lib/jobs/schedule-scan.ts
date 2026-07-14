import { after } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { processScanBatch } from "@/lib/jobs/process-scan";
import { listStaleInFlightScanIds, scanLeaseTtlMs } from "@/lib/jobs/scan-lease";

/** Run scan processing after the HTTP response — reliable in Next.js dev/server. */
export function scheduleScanProcessing(scanBatchId: string, organizationId?: string): void {
  after(async () => {
    try {
      await processScanBatch(scanBatchId, organizationId);
    } catch (err) {
      console.error(`[Scan] Batch ${scanBatchId} failed:`, err instanceof Error ? err.message : err);
      if (err instanceof Error && err.stack) console.error("[Scan] Stack:", err.stack);
      const supabase = createServiceClient();
      await supabase
        .from("scan_batches")
        .update({
          status: "failed",
          error_message: err instanceof Error ? err.message : "Processing failed",
          finished_at: new Date().toISOString(),
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq("id", scanBatchId)
        .in("status", ["queued", "dispatching", "provider_running", "normalizing"]);
    }
  });
}

/**
 * Kick a scan that still needs work:
 * - `queued` → start fresh processing
 * - stale `dispatching` / `provider_running` → reclaim + resume missing cells
 * Safe on every poll — claims are atomic.
 */
export function kickQueuedScanIfNeeded(scanBatchId: string, status: string, organizationId?: string): void {
  if (status === "queued") {
    scheduleScanProcessing(scanBatchId, organizationId);
    return;
  }

  if (status === "dispatching" || status === "provider_running") {
    // Always schedule processScanBatch; it no-ops unless the lease is stale / claimable.
    scheduleScanProcessing(scanBatchId, organizationId);
  }
}

/** Cron helper: reclaim a few globally stale in-flight scans. */
export async function reclaimStaleInFlightScans(limit = 5): Promise<number> {
  const ids = await listStaleInFlightScanIds(limit);
  for (const id of ids) {
    console.log(`[Scan] Cron reclaiming stale in-flight scan ${id} (lease TTL ${scanLeaseTtlMs()}ms)`);
    scheduleScanProcessing(id);
  }
  return ids.length;
}
