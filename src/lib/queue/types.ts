/** Named queues — keep workloads isolated so Maps cannot starve notifications. */
export type QueueName =
  | "maps-scan"
  | "maps-cell-retry"
  | "review-campaign"
  | "review-import"
  | "review-monitor"
  | "backlink-gap"
  | "local-trust"
  | "ai-visibility"
  | "report-generation"
  | "notifications"
  | "maintenance";

/** @deprecated Prefer QueueName — alias kept for worker scripts. */
export type JobQueueName = QueueName;

export const JOB_QUEUES = {
  MAPS_SCAN: "maps-scan",
  MAPS_CELL_RETRY: "maps-cell-retry",
  REVIEW_CAMPAIGN: "review-campaign",
  REVIEW_IMPORT: "review-import",
  REVIEW_MONITOR: "review-monitor",
  BACKLINK_GAP: "backlink-gap",
  LOCAL_TRUST: "local-trust",
  AI_VISIBILITY: "ai-visibility",
  REPORT_GENERATION: "report-generation",
  NOTIFICATIONS: "notifications",
  MAINTENANCE: "maintenance",
} as const satisfies Record<string, QueueName>;

export type QueueDriverName = "database" | "bullmq";

export type JobPriorityClass = "highest" | "normal" | "lower";

/** Lower number = higher priority (BullMQ convention). */
export const PRIORITY_SCORES: Record<JobPriorityClass, number> = {
  highest: 1,
  normal: 50,
  lower: 100,
};

export type EnqueueState =
  | "pending"
  | "pending_enqueue"
  | "enqueued"
  | "enqueue_failed"
  | "skipped";

export type EnqueueJobInput = {
  queueName: QueueName;
  jobType: string;
  payload: Record<string, unknown>;
  organizationId?: string | null;
  businessId?: string | null;
  /** Dedupes equivalent work. Required for customer-facing jobs when possible. */
  idempotencyKey?: string | null;
  priority?: JobPriorityClass | number;
  /** Delay before eligibility (ms). */
  delayMs?: number;
  maxAttempts?: number;
  costEstimate?: number | null;
};

export type EnqueueJobResult = {
  jobId: string;
  queueName: QueueName;
  driver: QueueDriverName;
  enqueueState: EnqueueState;
  /** True when an existing idempotent job was returned instead of creating a new one. */
  reused: boolean;
  status: string;
};

export type QueueJobRecord = {
  id: string;
  queueName: QueueName | null;
  jobType: string;
  payload: Record<string, unknown>;
  status: string;
  enqueueState: EnqueueState;
  organizationId: string | null;
  businessId: string | null;
  priority: number;
  attempts: number;
  maxAttempts: number;
  progress: Record<string, unknown>;
  errorMessage: string | null;
  scheduledAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  heartbeatAt: string | null;
};

export type QueueConfig = {
  name: QueueName;
  /** Worker concurrency for this queue (BullMQ worker). */
  concurrency: number;
  /** Max jobs started per duration (BullMQ limiter). */
  limiter?: { max: number; durationMs: number };
  /** Default max attempts. */
  maxAttempts: number;
  /** Soft timeout hint (ms) for observability / stalled detection. */
  timeoutMs: number;
  description: string;
};
