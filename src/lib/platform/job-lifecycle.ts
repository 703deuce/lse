/**
 * Platform-wide job lifecycle vocabulary (brief Part 2).
 * Feature tables may keep their own statuses; ledger `lifecycle_status` is canonical.
 */

export const JOB_LIFECYCLE = {
  CREATED: "created",
  PENDING_ENQUEUE: "pending_enqueue",
  QUEUED: "queued",
  RUNNING: "running",
  RETRYING: "retrying",
  PAUSED: "paused",
  COMPLETED: "completed",
  CANCELED: "canceled",
  PERMANENTLY_FAILED: "permanently_failed",
  ENQUEUE_FAILED: "enqueue_failed",
  DEAD_LETTER: "dead_letter",
} as const;

export type JobLifecycleStatus = (typeof JOB_LIFECYCLE)[keyof typeof JOB_LIFECYCLE];

/** Allowed conditional transitions (from → to[]). */
export const LIFECYCLE_TRANSITIONS: Record<JobLifecycleStatus, JobLifecycleStatus[]> = {
  created: ["pending_enqueue", "queued", "enqueue_failed", "canceled"],
  pending_enqueue: ["queued", "enqueue_failed", "canceled"],
  queued: ["running", "paused", "canceled"],
  running: ["completed", "retrying", "permanently_failed", "paused", "canceled", "dead_letter"],
  retrying: ["queued", "running", "permanently_failed", "dead_letter", "canceled"],
  paused: ["queued", "canceled"],
  completed: [],
  canceled: [],
  permanently_failed: ["queued"], // manual retry
  enqueue_failed: ["pending_enqueue", "queued", "dead_letter", "canceled"],
  dead_letter: ["queued"], // admin retry
};

export function canTransitionLifecycle(
  from: JobLifecycleStatus | null | undefined,
  to: JobLifecycleStatus
): boolean {
  if (!from) return to === "created" || to === "pending_enqueue" || to === "queued";
  return (LIFECYCLE_TRANSITIONS[from] ?? []).includes(to);
}

/** Map legacy job_queue.status + enqueue_state → lifecycle. */
export function deriveLifecycleStatus(row: {
  status?: string | null;
  enqueueState?: string | null;
}): JobLifecycleStatus {
  const enqueue = row.enqueueState ?? "pending";
  const status = row.status ?? "pending";
  if (enqueue === "enqueue_failed") return "enqueue_failed";
  if (status === "completed") return "completed";
  if (status === "failed") return "permanently_failed";
  if (status === "canceled" || status === "cancelled") return "canceled";
  if (status === "running") return "running";
  if (status === "pending" && enqueue === "enqueued") return "queued";
  if (status === "pending" && (enqueue === "pending" || enqueue === "pending_enqueue")) {
    return "pending_enqueue";
  }
  return "queued";
}

export function isTerminalLifecycle(status: JobLifecycleStatus): boolean {
  return (
    status === "completed" ||
    status === "canceled" ||
    status === "permanently_failed" ||
    status === "dead_letter"
  );
}
