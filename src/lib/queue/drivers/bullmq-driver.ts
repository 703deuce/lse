import {
  QUEUE_CONFIGS,
  getBullmqConnectionOptions,
  getQueuePrefix,
  getRedisUrl,
} from "@/lib/queue/config";
import {
  createLedgerJob,
  findJobByIdempotencyKey,
  markLedgerEnqueueFailed,
  markLedgerEnqueued,
} from "@/lib/queue/ledger";
import type { EnqueueJobInput, EnqueueJobResult, QueueName } from "@/lib/queue/types";
import { canReuseExistingJob } from "@/lib/queue/idempotency";

const queues = new Map<string, import("bullmq").Queue>();

async function getQueue(name: QueueName): Promise<import("bullmq").Queue> {
  const key = `${getQueuePrefix()}:${name}`;
  const existing = queues.get(key);
  if (existing) return existing;
  const { Queue } = await import("bullmq");
  const connection = getBullmqConnectionOptions(getRedisUrl());
  const cfg = QUEUE_CONFIGS[name];
  const q = new Queue(key, {
    connection,
    defaultJobOptions: {
      attempts: cfg.maxAttempts,
      backoff: { type: "exponential", delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  });
  queues.set(key, q);
  return q;
}

export async function bullmqEnqueue(input: EnqueueJobInput): Promise<EnqueueJobResult> {
  if (input.idempotencyKey) {
    const existing = await findJobByIdempotencyKey(input.idempotencyKey);
    if (existing && canReuseExistingJob(existing)) {
      return {
        jobId: existing.id,
        queueName: input.queueName,
        driver: "bullmq",
        enqueueState: existing.enqueueState,
        reused: true,
        status: existing.status,
      };
    }
  }

  const row = await createLedgerJob(input);

  try {
    const queue = await getQueue(input.queueName);
    const job = await queue.add(
      input.jobType,
      {
        ledgerJobId: row.id,
        jobType: input.jobType,
        ...input.payload,
        organizationId: input.organizationId ?? null,
        businessId: input.businessId ?? null,
      },
      {
        jobId: row.id,
        priority: row.priority,
        delay: input.delayMs ?? 0,
        attempts: input.maxAttempts ?? QUEUE_CONFIGS[input.queueName].maxAttempts,
      }
    );
    await markLedgerEnqueued(row.id, {
      queueJobId: String(job.id ?? row.id),
      enqueueState: "enqueued",
    });
    return {
      jobId: row.id,
      queueName: input.queueName,
      driver: "bullmq",
      enqueueState: "enqueued",
      reused: false,
      status: "pending",
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "BullMQ enqueue failed";
    await markLedgerEnqueueFailed(row.id, message);
    return {
      jobId: row.id,
      queueName: input.queueName,
      driver: "bullmq",
      enqueueState: "enqueue_failed",
      reused: false,
      status: "pending",
    };
  }
}

/** Push an existing ledger row onto BullMQ (recovery / reconnect). */
export async function bullmqRequeueLedgerJob(job: {
  id: string;
  queueName: QueueName;
  jobType: string;
  payload: Record<string, unknown>;
  organizationId: string | null;
  businessId: string | null;
  priority: number;
  maxAttempts: number;
}): Promise<void> {
  const queue = await getQueue(job.queueName);
  // Avoid jobId collisions with retained completed/failed Redis jobs.
  const existing = await queue.getJob(job.id).catch(() => null);
  if (existing) {
    await existing.remove().catch(() => {});
  }
  const bullJob = await queue.add(
    job.jobType,
    {
      ledgerJobId: job.id,
      jobType: job.jobType,
      ...job.payload,
      organizationId: job.organizationId,
      businessId: job.businessId,
    },
    {
      jobId: job.id,
      priority: job.priority,
      attempts: job.maxAttempts,
    }
  );
  await markLedgerEnqueued(job.id, {
    queueJobId: String(bullJob.id ?? job.id),
    enqueueState: "enqueued",
  });
}

/** Best-effort remove a Redis job so cancel/retry cannot race a stale worker. */
export async function bullmqRemoveLedgerJob(
  queueName: QueueName,
  jobId: string
): Promise<void> {
  const queue = await getQueue(queueName);
  const existing = await queue.getJob(jobId).catch(() => null);
  if (existing) await existing.remove().catch(() => {});
}

export async function closeBullmqConnections(): Promise<void> {
  for (const q of queues.values()) {
    await q.close().catch(() => {});
  }
  queues.clear();
}
