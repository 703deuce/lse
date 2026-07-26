/**
 * BullMQ worker entrypoint.
 *
 * Recommended Coolify layout (single worker):
 *
 *   npm run worker:all         ← Maps + messaging + intelligence + reports
 *
 * Optional specialized profiles still exist if you ever want to split again:
 *   npm run worker:maps
 *   npm run worker:messaging   ← do NOT run alongside worker:all
 *   npm run worker:intelligence
 *   npm run worker:reports
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
import { getBullmqConnectionOptions, getQueueConfig, assertRedisEndpointReady } from "../../src/lib/queue/config";
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
   * Optional messaging-only profile. Prefer worker:all — do not run this
   * alongside worker:all or the same jobs will be consumed twice.
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
  /** Default: every registered queue, including messaging. */
  all: listRegisteredQueueNames() as QueueName[],
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

  try {
    assertRedisEndpointReady(`worker:${profile}`);
  } catch (err) {
    console.error(err instanceof Error ? err.message : err);
    process.exit(1);
  }

  // Fail fast before constructing any BullMQ objects if a registry name is invalid.
  for (const queueName of listRegisteredQueueNames()) {
    assertValidBullmqQueueName(queueName);
  }

  console.log(`[worker] profile=${profile}`);
  if (profile === "all") {
    console.log(
      "[worker] profile=all consumes every queue (Maps + messaging + intelligence + reports). Do not also run worker:messaging."
    );
  } else if (profile === "messaging") {
    console.log(
      "[worker] messaging-only profile — optional. Prefer worker:all unless you intentionally split workers."
    );
  }

  // Safe fingerprint only — never log the full Brevo key.
  if (profile === "messaging" || profile === "all") {
    const { secretFingerprint, cleanSecret } = await import("../../src/lib/env/secrets");
    const brevoFp = secretFingerprint(process.env.BREVO_API_KEY);
    const fromEmail = cleanSecret(process.env.REVIEW_REQUEST_FROM_EMAIL);
    console.log(
      `[worker] brevo key present=${brevoFp.present} length=${brevoFp.length} prefix=${brevoFp.prefix} suffix=${brevoFp.suffix} hadWhitespaceOrQuotes=${brevoFp.hadWhitespace} looksLikeXkeysib=${Boolean(
        cleanSecret(process.env.BREVO_API_KEY)?.startsWith("xkeysib-")
      )} fromEmailConfigured=${Boolean(fromEmail)}`
    );
    if (!brevoFp.present) {
      console.warn(
        "[worker] BREVO_API_KEY is missing — campaign email will fail. Set it on the Coolify worker service."
      );
    } else if (brevoFp.hadWhitespace) {
      console.warn(
        "[worker] BREVO_API_KEY had surrounding whitespace/quotes — cleaned at send time, but fix the Coolify value."
      );
    }
  }

  const recovered = await recoverPendingEnqueues(100);
  if (recovered > 0) {
    console.log(`[worker] recovered ${recovered} pending enqueue(s)`);
  }

  // Soft-validate telemetry schema so missing failure_category columns are
  // detected once at boot (and inserts degrade gracefully) instead of per cell.
  if (profile === "maps" || profile === "all") {
    try {
      const { validateScanCellTelemetrySchema } = await import(
        "../../src/lib/jobs/scan-cell-telemetry"
      );
      await validateScanCellTelemetrySchema();
      console.log("[worker] scan_cell_telemetry schema probe complete");
    } catch (err) {
      console.warn(
        "[worker] scan_cell_telemetry schema probe skipped:",
        err instanceof Error ? err.message : err
      );
    }
    try {
      const { logMapsProviderAvailability } = await import(
        "../../src/lib/providers/maps-grid/orchestrator"
      );
      logMapsProviderAvailability("worker-boot");
    } catch (err) {
      console.warn(
        "[worker] maps provider availability probe skipped:",
        err instanceof Error ? err.message : err
      );
    }
  }

  const connection = getBullmqConnectionOptions(config.redisUrl, "worker");
  const queues = PROFILE_QUEUES[profile];
  const workers: Worker[] = [];

  if (!queues.length) {
    console.error(`[worker] profile=${profile} has no queues — refusing to start`);
    process.exit(1);
  }

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
