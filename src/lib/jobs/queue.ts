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
import { jobTypeToQueue } from "@/lib/queue/job-handlers";
import { processQueueJob } from "@/lib/queue/processors";
import type { QueueName } from "@/lib/queue/types";
import { isDeferredError } from "@/lib/queue/errors";

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

/** Requeue jobs stuck in `running` after a worker crash / deploys. */
async function reclaimStaleRunningJobs(
  supabase: ReturnType<typeof createServiceClient>
): Promise<string[]> {
  const { reclaimExpiredJobLeases } = await import("@/lib/queue/ledger");
  const leasedIds = await reclaimExpiredJobLeases(50).catch(() => [] as string[]);

  const staleBefore = new Date(Date.now() - JOB_RUNNING_STALE_MS).toISOString();
  const nowIso = new Date().toISOString();
  // Only steal jobs whose lease is missing/expired — do not interrupt heartbeated long work.
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
    .or(`lease_expires_at.is.null,lease_expires_at.lt.${nowIso}`)
    .select("id");

  const byStarted = (data ?? []).map((r) => r.id as string);
  const ids = [...new Set([...leasedIds, ...byStarted])];
  if (ids.length > 0) {
    logger.warn("job_queue_stale_running_reclaimed", {
      count: ids.length,
      leased: leasedIds.length,
      byStartedAt: byStarted.length,
      staleBefore,
    });
  }
  return ids;
}

/**
 * Job ledger marked completed while the scan batch is still non-terminal
 * (e.g. `normalizing` treated as already_done). Re-enqueue so a worker can finish.
 */
async function reconcileCompletedMapsJobScanMismatch(limit = 10): Promise<number> {
  const supabase = createServiceClient();
  const { data: jobs } = await supabase
    .from("job_queue")
    .select("id, payload, related_resource_id, organization_id, business_id, enqueue_state")
    .eq("job_type", "process_scan")
    .eq("status", "completed")
    .order("finished_at", { ascending: false })
    .limit(limit * 3);

  let fixed = 0;
  for (const job of jobs ?? []) {
    if (fixed >= limit) break;
    const payload = (job.payload ?? {}) as Record<string, unknown>;
    const scanBatchId =
      (typeof payload.scanBatchId === "string" && payload.scanBatchId) ||
      (typeof job.related_resource_id === "string" ? job.related_resource_id : null);
    if (!scanBatchId) continue;

    const { data: batch } = await supabase
      .from("scan_batches")
      .select("id, status, business_id")
      .eq("id", scanBatchId)
      .maybeSingle();
    if (!batch) continue;

    const status = String(batch.status);
    if (!["queued", "dispatching", "provider_running", "normalizing"].includes(status)) {
      continue;
    }

    const businessId =
      (batch.business_id as string | undefined) ||
      (typeof payload.businessId === "string" ? payload.businessId : undefined) ||
      (job.business_id as string | undefined);
    const organizationId =
      (typeof payload.organizationId === "string" ? payload.organizationId : undefined) ||
      (job.organization_id as string | undefined);
    if (!businessId || !organizationId) continue;

    logger.warn("maps_completed_job_nonterminal_scan", {
      jobId: job.id,
      scanBatchId,
      scanStatus: status,
    });

    // Clear terminal row's idempotency so a fresh run can enqueue.
    await supabase
      .from("job_queue")
      .update({ idempotency_key: null })
      .eq("id", job.id)
      .eq("status", "completed");

    const result = await enqueueMapsScanJob({
      scanBatchId,
      businessId,
      organizationId,
      priority: "highest",
    }).catch((err) => {
      logger.warn("maps_mismatch_reenqueue_failed", {
        scanBatchId,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    });
    if (result) fixed++;
  }
  return fixed;
}

/** Enqueue recurring messaging / monitor drains (idempotent per minute). */
async function enqueueRecurringDrains(): Promise<void> {
  const bucket = Math.floor(Date.now() / 60_000);
  await Promise.all([
    dispatchFeatureJob({
      // Lightweight orchestrator: enqueue due email/sms jobs (workers send).
      jobType: "campaign_send_batch",
      payload: { limit: 100 },
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
  const reclaimedIds = await reclaimStaleRunningJobs(supabase);
  const jobsReclaimed = reclaimedIds.length;
  // Under BullMQ, reclaimed pending rows have no Redis job — hand them back.
  if (resolveQueueDriver() === "bullmq" && reclaimedIds.length) {
    const { getLedgerJob, markLedgerEnqueueFailed } = await import("@/lib/queue/ledger");
    const { bullmqRequeueLedgerJob } = await import("@/lib/queue/drivers/bullmq-driver");
    for (const id of reclaimedIds) {
      const job = await getLedgerJob(id);
      if (!job?.queueName) continue;
      await bullmqRequeueLedgerJob({
        id: job.id,
        queueName: job.queueName,
        jobType: job.jobType,
        payload: job.payload,
        organizationId: job.organizationId,
        businessId: job.businessId,
        priority: job.priority,
        maxAttempts: job.maxAttempts,
      }).catch(async (err) => {
        await markLedgerEnqueueFailed(
          job.id,
          err instanceof Error ? err.message : "reclaim requeue failed"
        );
      });
    }
  }
  const scansReclaimed = await reclaimStaleInFlightScans(5);
  const mapsMismatches = await reconcileCompletedMapsJobScanMismatch(10).catch(() => 0);

  // Campaigns + review alerts go through named queues (messaging / intelligence workers).
  await enqueueRecurringDrains();

  // BullMQ workers own ledger job execution after handoff.
  if (resolveQueueDriver() === "bullmq") {
    if (mapsMismatches > 0) {
      logger.warn("maps_job_scan_mismatch_requeued", { count: mapsMismatches });
    }
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

  // Share claim/heartbeat/billing/summary path with BullMQ workers.
  for (const job of jobs) {
    const payload = (job.payload ?? {}) as Record<string, unknown>;
    const queueName = (job.queue_name as QueueName | null) || jobTypeToQueue(String(job.job_type));
    try {
      await processQueueJob(queueName, {
        ...payload,
        ledgerJobId: job.id,
        jobType: String(job.job_type),
      });
      processed++;
    } catch (err) {
      if (isDeferredError(err)) {
        // Ledger already rescheduled — deferred is not a failure.
        continue;
      }
      logger.error("job_queue_processing_failed", {
        jobId: job.id,
        jobType: job.job_type,
        error: err instanceof Error ? err.message : String(err),
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
