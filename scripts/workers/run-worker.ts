/**
 * BullMQ worker entrypoint.
 *
 * Coolify start commands (examples):
 *   npm run worker:maps
 *   npm run worker:messaging
 *   npm run worker:intelligence
 *   npm run worker:reports
 *   npm run worker:all
 *
 * Requires QUEUE_DRIVER=bullmq and REDIS_URL.
 */

import { Worker, UnrecoverableError } from "bullmq";
import {
  JOB_QUEUES,
  type JobQueueName,
  type QueueName,
} from "../../src/lib/queue/types";
import { getBullmqConnectionOptions, getQueueConfig } from "../../src/lib/queue/config";
import { isPermanentError, processQueueJob } from "../../src/lib/queue/processors";
import type { QueueJobPayload } from "../../src/lib/queue/processors";
import { recoverPendingEnqueues } from "../../src/lib/queue/service";

type WorkerProfile = "maps" | "messaging" | "intelligence" | "reports" | "all";

const PROFILE_QUEUES: Record<WorkerProfile, JobQueueName[]> = {
  maps: [JOB_QUEUES.MAPS_SCAN, JOB_QUEUES.MAPS_CELL_RETRY],
  messaging: [
    JOB_QUEUES.REVIEW_CAMPAIGN,
    JOB_QUEUES.REVIEW_IMPORT,
    JOB_QUEUES.NOTIFICATIONS,
  ],
  intelligence: [
    JOB_QUEUES.REVIEW_MONITOR,
    JOB_QUEUES.BACKLINK_GAP,
    JOB_QUEUES.LOCAL_TRUST,
    JOB_QUEUES.AI_VISIBILITY,
    JOB_QUEUES.MAINTENANCE,
  ],
  reports: [JOB_QUEUES.REPORT_GENERATION],
  all: Object.values(JOB_QUEUES) as QueueName[],
};

async function main() {
  const profile = (process.argv[2] ?? "all") as WorkerProfile;
  if (!(profile in PROFILE_QUEUES)) {
    console.error(`Unknown worker profile: ${profile}`);
    console.error(
      `Usage: tsx scripts/workers/run-worker.ts <${Object.keys(PROFILE_QUEUES).join("|")}>`
    );
    process.exit(1);
  }

  const config = getQueueConfig();
  if (config.driver !== "bullmq" || !config.redisUrl) {
    console.error(
      "Workers require QUEUE_DRIVER=bullmq and REDIS_URL. Refusing to start."
    );
    process.exit(1);
  }

  const recovered = await recoverPendingEnqueues(100);
  if (recovered > 0) {
    console.log(`[worker] recovered ${recovered} pending enqueue(s)`);
  }

  const connection = getBullmqConnectionOptions(config.redisUrl);
  const queues = PROFILE_QUEUES[profile];
  const workers: Worker[] = [];

  for (const queueName of queues) {
    const settings = config.queues[queueName];
    const worker = new Worker(
      `${config.prefix}:${queueName}`,
      async (job) => {
        const payload = job.data as QueueJobPayload;
        try {
          await processQueueJob(queueName, payload);
        } catch (err) {
          if (isPermanentError(err)) {
            throw new UnrecoverableError(
              err instanceof Error ? err.message : "Permanent job failure"
            );
          }
          throw err;
        }
      },
      {
        connection,
        concurrency: settings.concurrency,
        limiter: settings.limiter
          ? { max: settings.limiter.max, duration: settings.limiter.durationMs }
          : undefined,
      }
    );

    worker.on("completed", (job) => {
      console.log(`[worker:${queueName}] completed ${job.id}`);
    });
    worker.on("failed", (job, err) => {
      console.error(`[worker:${queueName}] failed ${job?.id}:`, err.message);
    });
    workers.push(worker);
    console.log(
      `[worker] listening on ${config.prefix}:${queueName} concurrency=${settings.concurrency}`
    );
  }

  const shutdown = async (signal: string) => {
    console.log(`[worker] ${signal} — shutting down`);
    await Promise.all(workers.map((w) => w.close()));
    process.exit(0);
  };
  process.on("SIGINT", () => void shutdown("SIGINT"));
  process.on("SIGTERM", () => void shutdown("SIGTERM"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
