import { createServiceClient } from "@/lib/db/client";
import { reclaimStaleInFlightScans } from "@/lib/jobs/schedule-scan";
import { maybeRunDataRetentionCleanup } from "@/lib/jobs/retention";
import { logger } from "@/lib/observability/logger";
import type { ContactImportMode } from "@/lib/reputation/contact-import";
import {
  enqueueMapsScanJob,
  enqueueReviewImportJob,
  reconcileLegacyPendingJobs,
  recoverPendingEnqueues,
  resolveQueueDriver,
} from "@/lib/queue";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";
import { executeJobType } from "@/lib/queue/job-handlers";

const JOB_RUNNING_STALE_MS = Number(process.env.JOB_RUNNING_STALE_MS ?? 20 * 60 * 1000);

/** @deprecated Prefer enqueueMapsScanJob / dispatchScanProcessing — kept for SQL/cron callers. */
export async function enqueueScanJob(scanBatchId: string, businessId?: string): Promise<void> {
  let organizationId = "";
  if (businessId) {
    const supabase = createServiceClient();
    const { data: biz } = await supabase
      .from("businesses")
      .select("organization_id")
      .eq("id", businessId)
      .maybeSingle();
    organizationId = (biz?.organization_id as string) ?? "";
  }
  if (!organizationId || !businessId) {
    const supabase = createServiceClient();
    await supabase.from("job_queue").insert({
      job_type: "process_scan",
      payload: { scanBatchId, businessId },
      status: "pending",
      queue_name: "maps-scan",
      enqueue_state: "enqueued",
      idempotency_key: `maps-scan:${scanBatchId}`,
    });
    return;
  }
  await enqueueMapsScanJob({
    scanBatchId,
    businessId,
    organizationId,
    priority: "normal",
  });
}

export async function enqueueImportContactsJob(payload: {
  uploadId: string;
  businessId: string;
  organizationId: string;
  mode: ContactImportMode;
}): Promise<void> {
  await enqueueReviewImportJob(payload);
}

function retryDelayMs(attempt: number): number {
  const base = Math.min(60_000, 1000 * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.floor(Math.random() * 1000);
  return base + jitter;
}

/** Requeue jobs stuck in `running` after a worker crash / deploys. */
async function reclaimStaleRunningJobs(
  supabase: ReturnType<typeof createServiceClient>
): Promise<number> {
  const { reclaimExpiredJobLeases } = await import("@/lib/queue/ledger");
  const leased = await reclaimExpiredJobLeases(50).catch(() => 0);

  const staleBefore = new Date(Date.now() - JOB_RUNNING_STALE_MS).toISOString();
  const { data } = await supabase
    .from("job_queue")
    .update({
      status: "pending",
      lifecycle_status: "queued",
      lease_owner: null,
      lease_expires_at: null,
      scheduled_at: new Date().toISOString(),
      error_message: "Reclaimed stale running job",
    })
    .eq("status", "running")
    .lt("started_at", staleBefore)
    .select("id");

  const count = (data?.length ?? 0) + leased;
  if (count > 0) {
    logger.warn("job_queue_stale_running_reclaimed", {
      count,
      leased,
      byStartedAt: data?.length ?? 0,
      staleBefore,
    });
  }
  return count;
}

/** Enqueue recurring messaging / monitor drains (idempotent per minute). */
async function enqueueRecurringDrains(): Promise<void> {
  const bucket = Math.floor(Date.now() / 60_000);
  await Promise.all([
    dispatchFeatureJob({
      jobType: "campaign_send_batch",
      payload: { limit: 20 },
      idempotencyKey: `campaign-drain:${bucket}`,
      priority: "normal",
      maxAttempts: 2,
    }).catch((err) => {
      logger.warn("campaign_drain_enqueue_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }),
    dispatchFeatureJob({
      jobType: "review_alert_scan",
      payload: { limit: 15 },
      idempotencyKey: `review-alert-drain:${bucket}`,
      priority: "highest",
      maxAttempts: 2,
    }).catch((err) => {
      logger.warn("review_alert_drain_enqueue_failed", {
        error: err instanceof Error ? err.message : String(err),
      });
    }),
  ]);
}

export async function processPendingJobs(limit = 5): Promise<{
  jobsProcessed: number;
  campaignSent: number;
  reviewAlertsSent: number;
  scansReclaimed: number;
  jobsReclaimed: number;
  retention: Awaited<ReturnType<typeof maybeRunDataRetentionCleanup>>;
}> {
  const supabase = createServiceClient();

  const retention = await maybeRunDataRetentionCleanup();
  const enqueueRecovered = await recoverPendingEnqueues(25).catch(() => 0);
  const legacyFixed = await reconcileLegacyPendingJobs(25).catch(() => 0);
  if (enqueueRecovered > 0 || legacyFixed > 0) {
    logger.info("job_queue_enqueue_recovered", { enqueueRecovered, legacyFixed });
  }
  const jobsReclaimed = await reclaimStaleRunningJobs(supabase);
  const scansReclaimed = await reclaimStaleInFlightScans(5);

  // Campaigns + review alerts go through named queues (messaging / intelligence workers).
  await enqueueRecurringDrains();

  // BullMQ workers own ledger job execution after handoff.
  if (resolveQueueDriver() === "bullmq") {
    return {
      jobsProcessed: 0,
      campaignSent: 0,
      reviewAlertsSent: 0,
      scansReclaimed,
      jobsReclaimed,
      retention,
    };
  }

  const { data: jobs } = await supabase
    .from("job_queue")
    .select("id, job_type, payload, attempts, max_attempts, status, scheduled_at, queue_name")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString())
    .order("priority", { ascending: true })
    .order("scheduled_at", { ascending: true })
    .limit(limit);

  if (!jobs?.length) {
    return {
      jobsProcessed: 0,
      campaignSent: 0,
      reviewAlertsSent: 0,
      scansReclaimed,
      jobsReclaimed,
      retention,
    };
  }

  let processed = 0;
  for (const job of jobs) {
    const { data: claimed } = await supabase
      .from("job_queue")
      .update({
        status: "running",
        started_at: new Date().toISOString(),
        attempts: (job.attempts ?? 0) + 1,
      })
      .eq("id", job.id)
      .eq("status", "pending")
      .select("id, job_type, payload, attempts, max_attempts")
      .maybeSingle();

    if (!claimed) continue;

    try {
      const payload = (claimed.payload ?? {}) as Record<string, unknown>;
      const result = await executeJobType(String(claimed.job_type), {
        ...payload,
        ledgerJobId: claimed.id,
      });

      if (!result.ok) {
        throw Object.assign(new Error(result.error ?? "Job failed"), {
          unrecoverable: result.permanent,
        });
      }

      if (result.markComplete === false) {
        await supabase
          .from("job_queue")
          .update({
            status: "pending",
            scheduled_at: new Date(Date.now() + 5_000).toISOString(),
            error_message: "Deferred — another worker holds the lease",
          })
          .eq("id", claimed.id);
        continue;
      }

      await supabase
        .from("job_queue")
        .update({ status: "completed", finished_at: new Date().toISOString() })
        .eq("id", claimed.id);
      processed++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      const permanent = Boolean(
        err instanceof Error && (err as Error & { unrecoverable?: boolean }).unrecoverable
      );
      const attempts = claimed.attempts ?? (job.attempts ?? 0) + 1;
      const maxAttempts = claimed.max_attempts ?? job.max_attempts ?? 3;
      const failed = permanent || attempts >= maxAttempts;
      const delay = retryDelayMs(attempts);

      await supabase
        .from("job_queue")
        .update({
          status: failed ? "failed" : "pending",
          lifecycle_status: permanent
            ? "permanently_failed"
            : failed
              ? "dead_letter"
              : "retrying",
          error_message: message,
          error_class: permanent ? "permanent" : failed ? "dead_letter" : "retryable",
          customer_error: failed
            ? "This job failed after multiple retries. An operator can retry it from Admin → Ops."
            : null,
          finished_at: failed ? new Date().toISOString() : null,
          scheduled_at: failed ? undefined : new Date(Date.now() + delay).toISOString(),
          lease_owner: null,
          lease_expires_at: null,
        })
        .eq("id", claimed.id);

      const payload = claimed.payload as { scanBatchId?: string };
      if (payload.scanBatchId && failed && claimed.job_type === "process_scan") {
        await supabase
          .from("scan_batches")
          .update({
            status: "failed",
            error_message: message,
            finished_at: new Date().toISOString(),
            lease_owner: null,
            lease_expires_at: null,
          })
          .eq("id", payload.scanBatchId)
          .in("status", ["queued", "dispatching", "provider_running", "normalizing"]);
      }
      logger.error("job_queue_processing_failed", {
        jobId: claimed.id,
        jobType: claimed.job_type,
        attempts,
        failed,
        error: message,
      });
    }
  }

  return {
    jobsProcessed: processed,
    campaignSent: 0,
    reviewAlertsSent: 0,
    scansReclaimed,
    jobsReclaimed,
    retention,
  };
}
