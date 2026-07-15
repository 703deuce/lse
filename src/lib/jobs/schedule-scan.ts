import { after } from "next/server";
import { createServiceClient } from "@/lib/db/client";
import { processScanBatch } from "@/lib/jobs/process-scan";
import { listStaleInFlightScanIds, scanLeaseTtlMs } from "@/lib/jobs/scan-lease";
import { maybeReleaseUnusedMapCredits } from "@/lib/jobs/map-credits";
import { enqueueMapsScanJob, resolveQueueDriver } from "@/lib/queue";
import { findJobByIdempotencyKey } from "@/lib/queue/ledger";
import { logger } from "@/lib/observability/logger";

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
      lifecycle_status: status === "completed" ? "completed" : "permanently_failed",
      finished_at: new Date().toISOString(),
      lease_owner: null,
      lease_expires_at: null,
      ...(errorMessage ? { error_message: errorMessage } : {}),
    })
    .eq("idempotency_key", `maps-scan:${scanBatchId}`)
    .in("status", ["pending", "running"]);
}

export function scheduleScanProcessing(scanBatchId: string, organizationId?: string): void {
  after(async () => {
    try {
      const outcome = await processScanBatch(scanBatchId, organizationId);
      if (outcome === "ran" || outcome === "already_done") {
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
          await maybeReleaseUnusedMapCredits(scanBatchId, organizationId, message);
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
  // Under BullMQ, Maps workers own execution — never steal via Next.js after() from polls.
  if (resolveQueueDriver() === "bullmq") {
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
        // Prefer requeueing the existing ledger row (avoids clearing idempotency
        // on enqueue_failed and creating a second live BullMQ job).
        const existing = await findJobByIdempotencyKey(`maps-scan:${id}`).catch(() => null);
        if (
          existing &&
          existing.queueName &&
          (existing.status === "pending" ||
            existing.status === "running" ||
            existing.enqueueState === "enqueue_failed")
        ) {
          const { bullmqRequeueLedgerJob } = await import(
            "@/lib/queue/drivers/bullmq-driver"
          );
          const { createServiceClient: svc } = await import("@/lib/db/client");
          const sb = svc();
          if (existing.status === "running" || existing.enqueueState === "enqueue_failed") {
            await sb
              .from("job_queue")
              .update({
                status: "pending",
                lifecycle_status: "queued",
                enqueue_state: "pending",
                lease_owner: null,
                lease_expires_at: null,
                scheduled_at: new Date().toISOString(),
              })
              .eq("id", existing.id)
              .in("status", ["pending", "running"]);
          }
          await bullmqRequeueLedgerJob({
            id: existing.id,
            queueName: existing.queueName,
            jobType: existing.jobType,
            payload: existing.payload,
            organizationId: existing.organizationId,
            businessId: existing.businessId,
            priority: existing.priority,
            maxAttempts: existing.maxAttempts,
          }).catch(async (err) => {
            const { markLedgerEnqueueFailed } = await import("@/lib/queue/ledger");
            await markLedgerEnqueueFailed(
              existing.id,
              err instanceof Error ? err.message : "reclaim requeue failed"
            );
            logger.warn("scan_reclaim_requeue_failed", {
              scanBatchId: id,
              jobId: existing.id,
              error: err instanceof Error ? err.message : String(err),
            });
          });
        } else {
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
        }
      } else {
        // Never run heavy Maps work on the web/cron process under BullMQ.
        logger.warn("scan_reclaim_missing_tenant", { scanBatchId: id });
      }
    } else {
      scheduleScanProcessing(id);
    }
  }
  return ids.length;
}
