import type { QueueConfig, QueueDriverName, QueueName } from "@/lib/queue/types";

export function getQueueDriverName(): QueueDriverName {
  const raw = (process.env.QUEUE_DRIVER ?? "database").trim().toLowerCase();
  if (raw === "bullmq") return "bullmq";
  return "database";
}

export function getRedisUrl(): string | null {
  const url = process.env.REDIS_URL?.trim();
  return url || null;
}

export function getQueuePrefix(): string {
  return process.env.QUEUE_PREFIX?.trim() || "lse";
}

/** Global Bright Data start rate (requests/sec) across all workers. */
export function brightDataStartRatePerSec(): number {
  const n = Number(process.env.BRIGHTDATA_GLOBAL_START_RATE_PER_SEC ?? 80);
  return Number.isFinite(n) && n > 0 ? n : 80;
}

/** Global in-flight Bright Data requests across all workers. */
export function brightDataMaxInFlight(): number {
  const n = Number(process.env.BRIGHTDATA_GLOBAL_MAX_IN_FLIGHT ?? 250);
  return Number.isFinite(n) && n > 0 ? n : 250;
}

/** Fair chunk size so one huge scan cannot monopolize the provider. */
export function brightDataFairChunkSize(): number {
  const n = Number(process.env.BRIGHTDATA_FAIR_CHUNK_SIZE ?? 25);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : 25;
}

export function maxActiveMapsScansPerOrg(): number {
  const n = Number(process.env.MAX_ACTIVE_MAPS_SCANS_PER_ORG ?? 3);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

export function maxQueuedMapsScansPerOrg(): number {
  const n = Number(process.env.MAX_QUEUED_MAPS_SCANS_PER_ORG ?? 10);
  return Number.isFinite(n) && n > 0 ? n : 10;
}

export type BullmqConnectionRole = "worker" | "producer";

/**
 * BullMQ connection options as plain ioredis fields (avoids duplicate-ioredis
 * type conflicts when constructing Redis clients in app vs bullmq's nested copy).
 *
 * Workers retry forever with bounded backoff + keepalive so a transient
 * ETIMEDOUT during deploy does not kill the process. Producers share the same
 * reconnect strategy; enqueue failures still mark ledger `enqueue_failed`.
 */
export function getBullmqConnectionOptions(
  redisUrl?: string | null,
  _role: BullmqConnectionRole = "producer"
): {
  host: string;
  port: number;
  username?: string;
  password?: string;
  maxRetriesPerRequest: null;
  enableReadyCheck: boolean;
  keepAlive: number;
  connectTimeout: number;
  retryStrategy: (times: number) => number | void;
  enableOfflineQueue: boolean;
  tls?: Record<string, never>;
} {
  const url = redisUrl ?? getRedisUrl();
  if (!url) throw new Error("REDIS_URL is required for BullMQ");
  const parsed = new URL(url);
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 6379),
    username: parsed.username || undefined,
    password: parsed.password || undefined,
    // Required for BullMQ blocking commands (BRPOPLPUSH / BZPOPMIN).
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    keepAlive: 30_000,
    connectTimeout: 20_000,
    // Indefinite reconnect with bounded backoff (ms).
    retryStrategy: (times: number) => Math.min(Math.max(times, 1) * 200, 5_000),
    enableOfflineQueue: true,
    ...(parsed.protocol === "rediss:" ? { tls: {} } : {}),
  };
}

export function getQueueConfig(): {
  driver: QueueDriverName;
  redisUrl: string | null;
  prefix: string;
  queues: Record<QueueName, QueueConfig>;
} {
  return {
    driver: getQueueDriverName(),
    redisUrl: getRedisUrl(),
    prefix: getQueuePrefix(),
    queues: QUEUE_CONFIGS,
  };
}

export const QUEUE_CONFIGS: Record<QueueName, QueueConfig> = {
  "maps-scan": {
    name: "maps-scan",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_MAPS_SCAN ?? 2),
    limiter: {
      max: Number(process.env.QUEUE_LIMITER_MAPS_SCAN_MAX ?? 20),
      durationMs: 60_000,
    },
    maxAttempts: 3,
    timeoutMs: 30 * 60_000,
    description: "Parent grid scan jobs (Bright Data)",
  },
  "maps-cell-retry": {
    name: "maps-cell-retry",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_MAPS_CELL_RETRY ?? 4),
    limiter: {
      max: Number(process.env.QUEUE_LIMITER_MAPS_CELL_RETRY_MAX ?? 40),
      durationMs: 60_000,
    },
    maxAttempts: 5,
    timeoutMs: 10 * 60_000,
    description: "Failed cell retry bursts",
  },
  "review-campaign": {
    name: "review-campaign",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_REVIEW_CAMPAIGN ?? 5),
    limiter: {
      max: Number(process.env.QUEUE_LIMITER_REVIEW_CAMPAIGN_MAX ?? 60),
      durationMs: 60_000,
    },
    maxAttempts: 5,
    timeoutMs: 5 * 60_000,
    description: "SMS/email review request sends",
  },
  "review-import": {
    name: "review-import",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_REVIEW_IMPORT ?? 2),
    maxAttempts: 3,
    timeoutMs: 15 * 60_000,
    description: "Contact CSV / review imports",
  },
  "review-monitor": {
    name: "review-monitor",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_REVIEW_MONITOR ?? 2),
    maxAttempts: 3,
    timeoutMs: 10 * 60_000,
    description: "Review velocity / new-review monitoring",
  },
  "backlink-gap": {
    name: "backlink-gap",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_BACKLINK_GAP ?? 1),
    limiter: { max: 10, durationMs: 60_000 },
    maxAttempts: 3,
    timeoutMs: 20 * 60_000,
    description: "Backlink Gap audits",
  },
  "local-trust": {
    name: "local-trust",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_LOCAL_TRUST ?? 1),
    limiter: { max: 10, durationMs: 60_000 },
    maxAttempts: 3,
    timeoutMs: 20 * 60_000,
    description: "Local Trust audits",
  },
  "ai-visibility": {
    name: "ai-visibility",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_AI_VISIBILITY ?? 1),
    limiter: { max: 6, durationMs: 60_000 },
    maxAttempts: 3,
    timeoutMs: 20 * 60_000,
    description: "AI Visibility prompt runs",
  },
  "report-generation": {
    name: "report-generation",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_REPORT_GENERATION ?? 2),
    maxAttempts: 3,
    timeoutMs: 10 * 60_000,
    description: "Client report / PDF generation",
  },
  notifications: {
    name: "notifications",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_NOTIFICATIONS ?? 5),
    maxAttempts: 5,
    timeoutMs: 2 * 60_000,
    description: "Transactional notifications",
  },
  maintenance: {
    name: "maintenance",
    concurrency: Number(process.env.QUEUE_CONCURRENCY_MAINTENANCE ?? 1),
    maxAttempts: 2,
    timeoutMs: 30 * 60_000,
    description: "Retention, reconciliation, cleanup",
  },
};
