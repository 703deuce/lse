import { createServiceClient } from "@/lib/db/client";
import {
  executeJobType,
  jobTypeToQueue,
  type JobHandlerPayload,
} from "@/lib/queue/job-handlers";
import type { QueueName } from "@/lib/queue/types";
import { logger } from "@/lib/observability/logger";
import { QUEUE_CONFIGS } from "@/lib/queue/config";
import { releaseUsage } from "@/lib/plans";

export type QueueJobPayload = JobHandlerPayload & {
  jobType?: string;
};

const TERMINAL_STATUSES = new Set(["completed", "failed", "canceled", "cancelled"]);

const LEASE_MS = 60_000;
const HEARTBEAT_MS = 20_000;

/**
 * Shared processors for BullMQ workers and Next.js after() kicks.
 * Database cron also uses executeJobType via processPendingJobs.
 */
export async function processQueueJob(
  queueName: QueueName,
  payload: QueueJobPayload
): Promise<void> {
  const supabase = createServiceClient();
  const ledgerJobId =
    (typeof payload.ledgerJobId === "string" && payload.ledgerJobId) ||
    (typeof payload.jobId === "string" && payload.jobId) ||
    null;

  let jobType = typeof payload.jobType === "string" ? payload.jobType : "";

  const workerId =
    process.env.WORKER_ID?.trim() ||
    process.env.HOSTNAME?.trim() ||
    `web-${process.pid}`;
  let attempts = 0;
  let maxAttempts = 3;
  let claimedOk = !ledgerJobId;
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null;

  try {
    if (ledgerJobId) {
      const claimed = await claimLedgerJob(ledgerJobId, workerId, supabase);
      if (claimed.kind === "skip") {
        logger.info("queue_processor_skip", {
          ledgerJobId,
          status: claimed.status,
          queueName,
        });
        return;
      }
      if (claimed.kind === "busy") {
        throw new Error("Job lease held by another worker");
      }
      claimedOk = true;
      jobType = jobType || claimed.jobType;
      attempts = claimed.attempts;
      maxAttempts = claimed.maxAttempts;
      heartbeatTimer = setInterval(() => {
        void extendLease(ledgerJobId, workerId).catch((err) => {
          logger.warn("queue_lease_heartbeat_failed", {
            ledgerJobId,
            error: err instanceof Error ? err.message : String(err),
          });
        });
      }, HEARTBEAT_MS);
    }

    if (!jobType) {
      jobType = defaultJobTypeForQueue(queueName);
    }

    if (jobTypeToQueue(jobType) !== queueName) {
      logger.warn("queue_processor_queue_mismatch", { queueName, jobType });
    }

    if (!claimedOk) {
      throw new Error("Refusing to execute unclaimed ledger job");
    }

    const result = await executeJobType(jobType, {
      ...payload,
      ledgerJobId: ledgerJobId ?? undefined,
    });

    if (!result.ok) {
      if (ledgerJobId) {
        const exhausted = !result.permanent && attempts >= maxAttempts;
        const terminal = result.permanent || exhausted;
        await supabase
          .from("job_queue")
          .update({
            status: terminal ? "failed" : "pending",
            lifecycle_status: result.permanent
              ? "permanently_failed"
              : exhausted
                ? "dead_letter"
                : "retrying",
            error_message: result.error ?? "Job failed",
            error_code: result.permanent ? "unrecoverable" : exhausted ? "dead_letter" : "retryable",
            error_class: result.permanent ? "permanent" : exhausted ? "dead_letter" : "retryable",
            customer_error: terminal
              ? "This job failed after multiple retries. An operator can retry it from Admin → Ops."
              : null,
            finished_at: terminal ? new Date().toISOString() : null,
            scheduled_at: terminal ? undefined : new Date(Date.now() + 5_000).toISOString(),
            lease_owner: null,
            lease_expires_at: null,
          })
          .eq("id", ledgerJobId)
          .eq("status", "running")
          .eq("lease_owner", workerId);

        if (terminal) {
          await releaseReservedUsage(payload);
          if (jobType === "early_enrichment") {
            await clearEarlyEnrichmentFlag(payload).catch(() => {});
          }
        }
      }
      if (result.permanent) {
        const err = new Error(result.error ?? "Permanent job failure");
        (err as Error & { unrecoverable?: boolean }).unrecoverable = true;
        throw err;
      }
      throw new Error(result.error ?? "Job failed");
    }

    if (ledgerJobId && result.markComplete === false) {
      // Mirror database-driver deferral — never ACK BullMQ on deferred work.
      await supabase
        .from("job_queue")
        .update({
          status: "pending",
          lifecycle_status: "queued",
          scheduled_at: new Date(Date.now() + 5_000).toISOString(),
          error_message: "Deferred — another worker holds the lease",
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq("id", ledgerJobId)
        .eq("status", "running")
        .eq("lease_owner", workerId);
      throw new Error("Deferred — another worker holds the lease");
    }

    if (ledgerJobId && result.markComplete !== false) {
      await markLedgerTerminal(ledgerJobId, "completed", workerId);
      const { rebuildFeatureSummaryAfterJob } = await import("@/lib/platform/summaries");
      await rebuildFeatureSummaryAfterJob({
        jobType,
        organizationId:
          typeof payload.organizationId === "string" ? payload.organizationId : null,
        businessId: typeof payload.businessId === "string" ? payload.businessId : null,
        jobId: ledgerJobId,
        payload,
      }).catch(() => {});
    }
  } finally {
    if (heartbeatTimer) clearInterval(heartbeatTimer);
  }
}

async function claimLedgerJob(
  ledgerJobId: string,
  workerId: string,
  supabase: ReturnType<typeof createServiceClient>
): Promise<
  | { kind: "claimed"; jobType: string; attempts: number; maxAttempts: number }
  | { kind: "skip"; status: string }
  | { kind: "busy" }
> {
  const leaseUntil = new Date(Date.now() + LEASE_MS).toISOString();
  const { data: claimed } = await supabase
    .from("job_queue")
    .update({
      status: "running",
      lifecycle_status: "running",
      started_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      worker_id: workerId,
      lease_owner: workerId,
      lease_expires_at: leaseUntil,
    })
    .eq("id", ledgerJobId)
    .eq("status", "pending")
    .select("id, attempts, max_attempts, job_type")
    .maybeSingle();

  if (claimed) {
    const attempts = (claimed.attempts ?? 0) + 1;
    await supabase.from("job_queue").update({ attempts }).eq("id", ledgerJobId);
    return {
      kind: "claimed",
      jobType: String(claimed.job_type ?? ""),
      attempts,
      maxAttempts: claimed.max_attempts ?? 3,
    };
  }

  const { data: row } = await supabase
    .from("job_queue")
    .select("status, job_type, lease_expires_at, attempts, max_attempts")
    .eq("id", ledgerJobId)
    .maybeSingle();

  if (!row || TERMINAL_STATUSES.has(String(row.status))) {
    return { kind: "skip", status: String(row?.status ?? "missing") };
  }

  if (row.status === "running") {
    const leaseExpired =
      row.lease_expires_at != null &&
      new Date(String(row.lease_expires_at)).getTime() < Date.now();
    if (!leaseExpired) return { kind: "busy" };

    const { data: reclaimed } = await supabase
      .from("job_queue")
      .update({
        status: "running",
        lifecycle_status: "running",
        started_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
        worker_id: workerId,
        lease_owner: workerId,
        lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString(),
      })
      .eq("id", ledgerJobId)
      .eq("status", "running")
      .lt("lease_expires_at", new Date().toISOString())
      .select("id, attempts, max_attempts, job_type")
      .maybeSingle();
    if (!reclaimed) return { kind: "busy" };

    const attempts = (reclaimed.attempts ?? 0) + 1;
    await supabase.from("job_queue").update({ attempts }).eq("id", ledgerJobId);
    return {
      kind: "claimed",
      jobType: String(reclaimed.job_type ?? ""),
      attempts,
      maxAttempts: reclaimed.max_attempts ?? 3,
    };
  }

  return { kind: "busy" };
}

async function extendLease(ledgerJobId: string, workerId: string): Promise<void> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("job_queue")
    .update({
      heartbeat_at: new Date().toISOString(),
      lease_expires_at: new Date(Date.now() + LEASE_MS).toISOString(),
    })
    .eq("id", ledgerJobId)
    .eq("status", "running")
    .eq("lease_owner", workerId)
    .select("id")
    .maybeSingle();
  if (!data) {
    throw new Error("Lost job lease");
  }
}

async function markLedgerTerminal(
  ledgerJobId: string,
  status: "completed" | "failed",
  workerId: string
): Promise<void> {
  const supabase = createServiceClient();
  await supabase
    .from("job_queue")
    .update({
      status,
      lifecycle_status: status === "completed" ? "completed" : "permanently_failed",
      finished_at: new Date().toISOString(),
      heartbeat_at: new Date().toISOString(),
      lease_owner: null,
      lease_expires_at: null,
    })
    .eq("id", ledgerJobId)
    .eq("status", "running")
    .eq("lease_owner", workerId);
}

async function releaseReservedUsage(payload: JobHandlerPayload): Promise<void> {
  if (!payload.reservedUsage || !payload.organizationId) return;
  await releaseUsage(
    String(payload.organizationId),
    payload.reservedUsage.key as Parameters<typeof releaseUsage>[1],
    payload.reservedUsage.amount
  ).catch(() => {});
}

async function clearEarlyEnrichmentFlag(payload: JobHandlerPayload): Promise<void> {
  const scanBatchId = typeof payload.scanBatchId === "string" ? payload.scanBatchId : "";
  if (!scanBatchId) return;
  const supabase = createServiceClient();
  await supabase
    .from("scan_batches")
    .update({ early_enrichment_started: false })
    .eq("id", scanBatchId)
    .eq("early_enrichment_started", true);
}

function defaultJobTypeForQueue(queueName: QueueName): string {
  switch (queueName) {
    case "maps-scan":
      return "process_scan";
    case "maps-cell-retry":
      return "retry_scan_cells";
    case "review-import":
      return "import_contacts";
    case "review-campaign":
      return "campaign_send_batch";
    case "review-monitor":
      return "review_alert_scan";
    case "backlink-gap":
      return "backlink_gap_run";
    case "local-trust":
      return "local_trust_run";
    case "ai-visibility":
      return "ai_visibility_run";
    case "report-generation":
      return "generate_report";
    case "notifications":
      return "send_notification";
    case "maintenance":
      return "data_retention";
    default:
      return "data_retention";
  }
}

export function isPermanentError(err: unknown): boolean {
  return Boolean(err instanceof Error && (err as Error & { unrecoverable?: boolean }).unrecoverable);
}

/** Expose for tests / worker lockDuration. */
export function bullmqLockDurationMs(queueName: QueueName): number {
  const timeout = QUEUE_CONFIGS[queueName]?.timeoutMs ?? 300_000;
  // Lock must outlive typical work; renewals also use BullMQ's lock renewal.
  return Math.max(timeout + 60_000, 120_000);
}
