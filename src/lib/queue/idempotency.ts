import type { QueueJobRecord } from "@/lib/queue/types";

/**
 * Only reuse jobs that are still live work. Canceled / failed / enqueue_failed
 * must create a new ledger row (or go through explicit admin retry).
 */
export function canReuseExistingJob(job: QueueJobRecord): boolean {
  if (job.status === "pending" || job.status === "running") {
    // Only fully handed-off jobs — never reuse enqueue_failed / half-created rows.
    return job.enqueueState === "enqueued";
  }
  return false;
}

/** Stable short key for optional id lists in idempotency keys. */
export function payloadIdKey(ids?: string[] | null): string {
  if (!ids?.length) return "all";
  return [...ids].map(String).sort().join(",").slice(0, 120);
}

/** Time-bucket segment for short-window idempotency keys (default 30s). */
export function idempotencyTimeBucket(windowMs = 30_000): number {
  return Math.floor(Date.now() / windowMs);
}
