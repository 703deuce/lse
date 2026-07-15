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

  if (ledgerJobId) {
    const { data: claimed } = await supabase
      .from("job_queue")
      .update({
        status: "running",
        lifecycle_status: "running",
        started_at: new Date().toISOString(),
        heartbeat_at: new Date().toISOString(),
      })
      .eq("id", ledgerJobId)
      .eq("status", "pending")
      .select("id, attempts, max_attempts, job_type, queue_name")
      .maybeSingle();

    if (!claimed) {
      const { data: row } = await supabase
        .from("job_queue")
        .select("status, job_type")
        .eq("id", ledgerJobId)
        .maybeSingle();
      if (!row || row.status === "completed" || row.status === "failed" || row.status === "running") {
        logger.info("queue_processor_skip", {
          ledgerJobId,
          status: row?.status ?? "missing",
          queueName,
        });
        return;
      }
      jobType = jobType || String(row.job_type ?? "");
    } else {
      jobType = jobType || String(claimed.job_type ?? "");
      await supabase
        .from("job_queue")
        .update({ attempts: (claimed.attempts ?? 0) + 1 })
        .eq("id", ledgerJobId);
    }
  }

  if (!jobType) {
    // Infer from queue when BullMQ only passes queue name.
    jobType = defaultJobTypeForQueue(queueName);
  }

  // Guard against wrong worker/queue pairing.
  if (jobTypeToQueue(jobType) !== queueName) {
    logger.warn("queue_processor_queue_mismatch", { queueName, jobType });
  }

  const result = await executeJobType(jobType, payload);

  if (!result.ok) {
    if (ledgerJobId) {
      await supabase
        .from("job_queue")
        .update({
          status: result.permanent ? "failed" : "pending",
          lifecycle_status: result.permanent ? "permanently_failed" : "retrying",
          error_message: result.error ?? "Job failed",
          error_code: result.permanent ? "unrecoverable" : "retryable",
          error_class: result.permanent ? "permanent" : "retryable",
          finished_at: result.permanent ? new Date().toISOString() : null,
          scheduled_at: result.permanent
            ? undefined
            : new Date(Date.now() + 5_000).toISOString(),
        })
        .eq("id", ledgerJobId);
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
    })
    .eq("id", ledgerJobId);
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
