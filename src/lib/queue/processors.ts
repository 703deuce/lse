import { createServiceClient } from "@/lib/db/client";
import {
  executeJobType,
  jobTypeToQueue,
  type JobHandlerPayload,
} from "@/lib/queue/job-handlers";
import type { QueueName } from "@/lib/queue/types";
import { logger } from "@/lib/observability/logger";

export type QueueJobPayload = JobHandlerPayload & {
  jobType?: string;
};

const TERMINAL_STATUSES = new Set(["completed", "failed", "canceled", "cancelled"]);

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
  let claimedOk = !ledgerJobId; // no ledger → execute unbound (legacy)

  if (ledgerJobId) {
    const { data: claimed } = await supabase
      .from("job_queue")
      .update({
        status: "running",
        lifecycle_status: "running",
        started_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
        worker_id: workerId,
        lease_owner: workerId,
        lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
      })
      .eq("id", ledgerJobId)
      .eq("status", "pending")
      .select("id, attempts, max_attempts, job_type, queue_name")
      .maybeSingle();

    if (claimed) {
      claimedOk = true;
      jobType = jobType || String(claimed.job_type ?? "");
      attempts = (claimed.attempts ?? 0) + 1;
      maxAttempts = claimed.max_attempts ?? 3;
      await supabase.from("job_queue").update({ attempts }).eq("id", ledgerJobId);
    } else {
      const { data: row } = await supabase
        .from("job_queue")
        .select("status, job_type, lease_expires_at, attempts, max_attempts")
        .eq("id", ledgerJobId)
        .maybeSingle();

      if (!row || TERMINAL_STATUSES.has(String(row.status))) {
        logger.info("queue_processor_skip", {
          ledgerJobId,
          status: row?.status ?? "missing",
          queueName,
        });
        return;
      }

      if (row.status === "running") {
        const leaseExpired =
          row.lease_expires_at != null &&
          new Date(String(row.lease_expires_at)).getTime() < Date.now();
        if (!leaseExpired) {
          // Another worker still holds the lease — force BullMQ retry, do not ack.
          throw new Error("Job lease held by another worker");
        }
        const { data: reclaimed } = await supabase
          .from("job_queue")
          .update({
            status: "running",
            lifecycle_status: "running",
            started_at: new Date().toISOString(),
            heartbeat_at: new Date().toISOString(),
            worker_id: workerId,
            lease_owner: workerId,
            lease_expires_at: new Date(Date.now() + 60_000).toISOString(),
          })
          .eq("id", ledgerJobId)
          .eq("status", "running")
          .lt("lease_expires_at", new Date().toISOString())
          .select("id, attempts, max_attempts, job_type")
          .maybeSingle();
        if (!reclaimed) {
          throw new Error("Job lease held by another worker");
        }
        claimedOk = true;
        jobType = jobType || String(reclaimed.job_type ?? "");
        attempts = (reclaimed.attempts ?? 0) + 1;
        maxAttempts = reclaimed.max_attempts ?? 3;
        await supabase.from("job_queue").update({ attempts }).eq("id", ledgerJobId);
      } else {
        // Pending claim race — retry.
        throw new Error("Failed to claim pending job");
      }
    }
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

  const result = await executeJobType(jobType, payload);

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
        .eq("status", "running");
    }
    if (result.permanent) {
      const err = new Error(result.error ?? "Permanent job failure");
      (err as Error & { unrecoverable?: boolean }).unrecoverable = true;
      throw err;
    }
    throw new Error(result.error ?? "Job failed");
  }

  if (ledgerJobId && result.markComplete !== false) {
    await markLedgerTerminal(ledgerJobId, "completed");
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
}

async function markLedgerTerminal(
  ledgerJobId: string,
  status: "completed" | "failed"
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
    .eq("status", "running");
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
