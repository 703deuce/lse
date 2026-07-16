/**
 * BullMQ worker entrypoint.
 *
 * Deployment modes (mutually exclusive — pick ONE):
 *
 *   A) Single combined worker (small / early servers):
 *        npm run worker:all
 *      Do NOT also run worker:maps / messaging / intelligence / reports.
 *
 *   B) Split workers (scale / isolation):
 *        npm run worker:maps
 *        npm run worker:messaging
 *        npm run worker:intelligence
 *        npm run worker:reports
 *      Do NOT also run worker:all.
 *
 * Why messaging queues appear on worker:all:
 *   Campaign email/sms (email-send, sms-send) are queue jobs. worker:all is a
 *   convenience profile that consumes every queue so one Coolify service can
 *   run the whole platform. It is NOT for Quick Send (that stays sync in the
 *   web request). Running worker:all AND worker:messaging doubles concurrency
 *   on shared queues (does not usually double-send, but can overload providers).
 *
 * Requires QUEUE_DRIVER=bullmq and REDIS_URL.
 *
 * Queue *names* are hyphenated (`maps-scan`). Namespacing uses BullMQ's
 * `prefix` option (`QUEUE_PREFIX`, default `lse`) — never `${prefix}:${name}`.
 */

import { DelayedError, Worker, UnrecoverableError } from "bullmq";
import {
  JOB_QUEUES,
  type JobQueueName,
  type QueueName,
} from "../../src/lib/queue/types";
import { getBullmqConnectionOptions, getQueueConfig } from "../../src/lib/queue/config";
import {
  assertValidBullmqQueueName,
  listRegisteredQueueNames,
  resolveBullmqQueueIdentity,
} from "../../src/lib/queue/bullmq-names";
import {
  bullmqLockDurationMs,
  isDeferredError,
  isPermanentError,
  processQueueJob,
} from "../../src/lib/queue/processors";
import type { QueueJobPayload } from "../../src/lib/queue/processors";
import { recoverPendingEnqueues } from "../../src/lib/queue/service";

type WorkerProfile = "maps" | "messaging" | "intelligence" | "reports" | "all";

const PROFILE_QUEUES: Record<WorkerProfile, JobQueueName[]> = {
  maps: [JOB_QUEUES.MAPS_SCAN, JOB_QUEUES.MAPS_CELL_RETRY],
  /**
   * Messaging: campaign orchestrator + Brevo/Twilio senders + imports/alerts.
   * Isolated from Maps so a large campaign cannot starve grid scans.
   */
  messaging: [
    JOB_QUEUES.REVIEW_CAMPAIGN,
    JOB_QUEUES.EMAIL_SEND,
    JOB_QUEUES.SMS_SEND,
    JOB_QUEUES.REVIEW_IMPORT,
    JOB_QUEUES.REVIEW_MONITOR,
    JOB_QUEUES.NOTIFICATIONS,
  ],
  intelligence: [
    JOB_QUEUES.BACKLINK_GAP,
    JOB_QUEUES.LOCAL_TRUST,
    JOB_QUEUES.AI_VISIBILITY,
    JOB_QUEUES.MAINTENANCE,
  ],
  reports: [JOB_QUEUES.REPORT_GENERATION],
  all: [...listRegisteredQueueNames()] as QueueName[],
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

  // Fail fast before constructing any BullMQ objects if a registry name is invalid.
  for (const queueName of listRegisteredQueueNames()) {
    assertValidBullmqQueueName(queueName);
  }

  const recovered = await recoverPendingEnqueues(100);
  if (recovered > 0) {
    console.log(`[worker] recovered ${recovered} pending enqueue(s)`);
  }

  const connection = getBullmqConnectionOptions(config.redisUrl, "worker");
  const queues = PROFILE_QUEUES[profile];
  const workers: Worker[] = [];

  for (const queueName of queues) {
    const settings = config.queues[queueName];
    const { name, prefix } = resolveBullmqQueueIdentity(queueName);
    const worker = new Worker(
      name,
      async (job) => {
        const payload = job.data as QueueJobPayload;
        try {
          await processQueueJob(queueName, payload);
        } catch (err) {
          if (isDeferredError(err)) {
            const delayMs =
              typeof (err as { delayMs?: number }).delayMs === "number"
                ? (err as { delayMs: number }).delayMs
                : 5_000;
            await job.moveToDelayed(Date.now() + delayMs, job.token);
            throw new DelayedError();
          }
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
        prefix,
        concurrency: settings.concurrency,
        // Must cover long Maps/intelligence work; our processor also heartbeats the ledger lease.
        lockDuration: bullmqLockDurationMs(queueName),
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
    worker.on("error", (err) => {
      // Connection blips (ETIMEDOUT) should log and reconnect — not exit.
      console.error(`[worker:${queueName}] error:`, err.message);
    });
    workers.push(worker);
    console.log(
      `[worker] listening on name=${name} prefix=${prefix} concurrency=${settings.concurrency}`
    );
  }

  console.log(
    `[worker] redis reconnect=indefinite keepalive=30s host=${connection.host}:${connection.port}`
  );

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
