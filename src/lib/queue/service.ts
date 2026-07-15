import { getQueueDriverName, getRedisUrl } from "@/lib/queue/config";
import { databaseEnqueue } from "@/lib/queue/drivers/database-driver";
import {
  bullmqEnqueue,
  bullmqRequeueLedgerJob,
} from "@/lib/queue/drivers/bullmq-driver";
import {
  createLedgerJob,
  getLedgerJob,
  listEnqueueFailedJobs,
  markLedgerEnqueueFailed,
} from "@/lib/queue/ledger";
import type {
  EnqueueJobInput,
  EnqueueJobResult,
  QueueDriverName,
  QueueJobRecord,
} from "@/lib/queue/types";
import { logger } from "@/lib/observability/logger";

/**
 * Public queue API — feature code must call this, never BullMQ or job_queue directly.
 *
 * Driver is explicit via QUEUE_DRIVER (never inferred from a flaky Redis ping).
 */
export function resolveQueueDriver(): QueueDriverName {
  const driver = getQueueDriverName();
  if (driver === "bullmq" && !getRedisUrl()) {
    logger.warn("queue_driver_bullmq_without_redis", {
      message: "QUEUE_DRIVER=bullmq but REDIS_URL is empty — enqueues will mark enqueue_failed",
    });
  }
  return driver;
}

export async function enqueueJob(input: EnqueueJobInput): Promise<EnqueueJobResult> {
  const driver = resolveQueueDriver();
  if (driver === "bullmq") {
    if (!getRedisUrl()) {
      const row = await createLedgerJob(input);
      await markLedgerEnqueueFailed(row.id, "REDIS_URL missing with QUEUE_DRIVER=bullmq");
      return {
        jobId: row.id,
        queueName: input.queueName,
        driver: "bullmq",
        enqueueState: "enqueue_failed",
        reused: false,
        status: "pending",
      };
    }
    return bullmqEnqueue(input);
  }
  return databaseEnqueue(input);
}

export async function getJobStatus(jobId: string): Promise<QueueJobRecord | null> {
  return getLedgerJob(jobId);
}

/**
 * Re-attempt BullMQ handoff for ledger rows stuck in enqueue_failed.
 * Does not create a second ledger row — reuses the same job id.
 */
export async function recoverPendingEnqueues(limit = 25): Promise<number> {
  if (resolveQueueDriver() !== "bullmq" || !getRedisUrl()) return 0;

  const failed = await listEnqueueFailedJobs(limit);
  let recovered = 0;
  for (const job of failed) {
    if (!job.queueName) continue;
    try {
      await bullmqRequeueLedgerJob({
        id: job.id,
        queueName: job.queueName,
        jobType: job.jobType,
        payload: job.payload,
        organizationId: job.organizationId,
        businessId: job.businessId,
        priority: job.priority,
        maxAttempts: job.maxAttempts,
      });
      recovered++;
    } catch (err) {
      logger.warn("queue_enqueue_recovery_item_failed", {
        jobId: job.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }
  if (recovered > 0) {
    logger.info("queue_enqueue_recovery", { recovered, scanned: failed.length });
  }
  return recovered;
}

/** Convenience: Maps parent scan enqueue. */
export async function enqueueMapsScanJob(params: {
  scanBatchId: string;
  businessId: string;
  organizationId: string;
  priority?: EnqueueJobInput["priority"];
}): Promise<EnqueueJobResult> {
  return enqueueJob({
    queueName: "maps-scan",
    jobType: "process_scan",
    payload: {
      scanBatchId: params.scanBatchId,
      businessId: params.businessId,
    },
    organizationId: params.organizationId,
    businessId: params.businessId,
    idempotencyKey: `maps-scan:${params.scanBatchId}`,
    priority: params.priority ?? "highest",
    maxAttempts: 3,
  });
}

/** Convenience: contact import. */
export async function enqueueReviewImportJob(params: {
  uploadId: string;
  businessId: string;
  organizationId: string;
  mode: string;
}): Promise<EnqueueJobResult> {
  return enqueueJob({
    queueName: "review-import",
    jobType: "import_contacts",
    payload: {
      uploadId: params.uploadId,
      businessId: params.businessId,
      organizationId: params.organizationId,
      mode: params.mode,
    },
    organizationId: params.organizationId,
    businessId: params.businessId,
    idempotencyKey: `review-import:${params.uploadId}`,
    priority: "normal",
    maxAttempts: 3,
  });
}
