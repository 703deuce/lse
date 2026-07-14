import { after } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { processScanBatch } from "@/lib/jobs/process-scan";
import { listStaleInFlightScanIds, scanLeaseTtlMs } from "@/lib/jobs/scan-lease";
import { gridMapCredits, releaseUsage } from "@/lib/plans";

const PRE_PROVIDER_FAIL =
  /No keywords|No matching keywords|Scan center is missing|Business not found|Failed to create scan points|No grid points left after exclusions/i;

async function maybeReleasePreProviderCredits(
  scanBatchId: string,
  organizationId: string,
  message: string
): Promise<void> {
  if (!PRE_PROVIDER_FAIL.test(message)) return;

  const supabase = createServiceClient();
  const { data: batch } = await supabase
    .from("scan_batches")
    .select("grid_size")
    .eq("id", scanBatchId)
    .maybeSingle();
  if (!batch?.grid_size) return;

  const { data: points } = await supabase
    .from("scan_points")
    .select("id")
    .eq("scan_batch_id", scanBatchId);
  const pointIds = (points ?? []).map((p) => p.id);

  let resultCount = 0;
  if (pointIds.length) {
    const { count } = await supabase
      .from("scan_results")
      .select("id", { count: "exact", head: true })
      .in("scan_point_id", pointIds);
    resultCount = count ?? 0;
  }

  // Only refund when no provider cells produced results.
  if (resultCount > 0) return;

  await releaseUsage(organizationId, "map_credits_used", gridMapCredits(Number(batch.grid_size)));
}

/** Run scan processing after the HTTP response — reliable in Next.js dev/server. */
export function scheduleScanProcessing(scanBatchId: string, organizationId?: string): void {
  after(async () => {
    try {
      await processScanBatch(scanBatchId, organizationId);
    } catch (err) {
      console.error(`[Scan] Batch ${scanBatchId} failed:`, err instanceof Error ? err.message : err);
      if (err instanceof Error && err.stack) console.error("[Scan] Stack:", err.stack);
      const supabase = createServiceClient();
      const message = err instanceof Error ? err.message : "Processing failed";
      await supabase
        .from("scan_batches")
        .update({
          status: "failed",
          error_message: message,
          finished_at: new Date().toISOString(),
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq("id", scanBatchId)
        .in("status", ["queued", "dispatching", "provider_running", "normalizing"]);

      if (organizationId) {
        try {
          await maybeReleasePreProviderCredits(scanBatchId, organizationId, message);
        } catch (releaseErr) {
          console.error(
            `[Scan] Failed to release credits for ${scanBatchId}:`,
            releaseErr instanceof Error ? releaseErr.message : releaseErr
          );
        }
      }
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
