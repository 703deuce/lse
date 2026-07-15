import { after } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { processScanBatch } from "@/lib/jobs/process-scan";
import { listStaleInFlightScanIds, scanLeaseTtlMs } from "@/lib/jobs/scan-lease";
import { gridMapCredits, releaseUsage } from "@/lib/plans";
import { enqueueMapsScanJob, resolveQueueDriver } from "@/lib/queue";
import { logger } from "@/lib/observability/logger";

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

/** Run scan processing after the HTTP response — database-driver fast path. */
async function markMapsLedgerTerminal(
  scanBatchId: string,
  status: "completed" | "failed",
  errorMessage?: string
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("job_queue")
    .update({
      status,
      finished_at: new Date().toISOString(),
      ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    .eq("idempotency_key", `maps-scan:${scanBatchId}`)
    .in("status", ["pending", "running"]);
}

export function scheduleScanProcessing(scanBatchId: string, organizationId?: string): void {
  after(async () => {
    try {
      const ran = await processScanBatch(scanBatchId, organizationId);
      if (ran) {
        await markMapsLedgerTerminal(scanBatchId, "completed").catch(() => {});
      }
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

      await markMapsLedgerTerminal(scanBatchId, "failed", message).catch(() => {});

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
 * Preferred entry: create durable ledger job, then kick the correct execution path.
 * - database driver: Next.js `after()` for low-latency + cron drain as backup
 * - bullmq driver: Redis worker picks up the job (no after() monopolizing the web process)
 */
export async function dispatchScanProcessing(params: {
  scanBatchId: string;
  businessId: string;
  organizationId: string;
}): Promise<{ jobId: string; driver: string }> {
  const result = await enqueueMapsScanJob({
    scanBatchId: params.scanBatchId,
    businessId: params.businessId,
    organizationId: params.organizationId,
    priority: "highest",
  });

  const driver = resolveQueueDriver();
  if (driver === "database") {
    // Fast path so interactive scans don't wait for the next cron minute.
    scheduleScanProcessing(params.scanBatchId, params.organizationId);
  } else {
    logger.info("scan_dispatched_bullmq", {
      scanBatchId: params.scanBatchId,
      jobId: result.jobId,
      enqueueState: result.enqueueState,
    });
  }

  return { jobId: result.jobId, driver };
}

/**
 * Kick a scan that still needs work:
 * - `queued` → start fresh processing
 * - stale `dispatching` / `provider_running` → reclaim + resume missing cells
 * Safe on every poll — claims are atomic.
 */
export function kickQueuedScanIfNeeded(scanBatchId: string, status: string, organizationId?: string): void {
  // Under BullMQ, workers own execution — poll kicks only reclaim via database path.
  if (resolveQueueDriver() === "bullmq" && status !== "queued") {
    return;
  }

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
  const driver = resolveQueueDriver();
  for (const id of ids) {
    console.log(`[Scan] Cron reclaiming stale in-flight scan ${id} (lease TTL ${scanLeaseTtlMs()}ms)`);
    if (driver === "bullmq") {
      // Re-deliver via queue so a Maps worker resumes; do not monopolize cron/web.
      const supabase = createServiceClient();
      const { data: batch } = await supabase
        .from("scan_batches")
        .select("business_id")
        .eq("id", id)
        .maybeSingle();
      const businessId = batch?.business_id as string | undefined;
      let organizationId: string | undefined;
      if (businessId) {
        const { data: biz } = await supabase
          .from("businesses")
          .select("organization_id")
          .eq("id", businessId)
          .maybeSingle();
        organizationId = biz?.organization_id as string | undefined;
      }
      if (businessId && organizationId) {
        await enqueueMapsScanJob({
          scanBatchId: id,
          businessId,
          organizationId,
          priority: "highest",
        }).catch((err) => {
          logger.warn("scan_reclaim_enqueue_failed", {
            scanBatchId: id,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      } else {
        scheduleScanProcessing(id);
      }
    } else {
      scheduleScanProcessing(id);
    }
  }
  return ids.length;
}
