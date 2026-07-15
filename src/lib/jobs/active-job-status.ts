/**
 * Shared adaptive polling helpers for active background jobs.
 * Browser hook: `useActiveJobStatus` in components/jobs/use-active-job-status.ts
 */

export type ActiveJobPhase =
  | "queued"
  | "active"
  | "retrying"
  | "finalizing"
  | "completed"
  | "failed"
  | "unknown";

export type LightweightJobStatus = {
  jobId: string;
  status: string;
  phase: ActiveJobPhase;
  progress?: {
    completed?: number;
    total?: number;
    failed?: number;
  };
  updatedAt?: string | null;
  errorMessage?: string | null;
};

const TERMINAL = new Set(["completed", "failed", "cancelled", "canceled"]);

export function isTerminalJobStatus(status: string): boolean {
  return TERMINAL.has(status);
}

export function isActiveJobStatus(status: string): boolean {
  return !isTerminalJobStatus(status) && status !== "unknown";
}

/**
 * Adaptive interval: fast while work is moving, slower if stuck long.
 * @param startedAtMs when polling began
 * @param lastChangeAtMs last time status/progress changed
 */
export function nextPollIntervalMs(
  startedAtMs: number,
  lastChangeAtMs: number,
  now = Date.now()
): number {
  const age = now - startedAtMs;
  const quiet = now - lastChangeAtMs;
  if (age < 60_000 && quiet < 10_000) return 1500;
  if (age < 3 * 60_000) return 5000;
  if (quiet > 30_000) return 15_000;
  return 10_000;
}

export function derivePhase(status: string, progress?: LightweightJobStatus["progress"]): ActiveJobPhase {
  if (status === "completed" || status === "rank_ready") return "completed";
  if (status === "failed") return "failed";
  if (status === "queued" || status === "pending") return "queued";
  if (status === "normalizing" || status === "enriching") return "finalizing";
  if ((progress?.failed ?? 0) > 0 && (progress?.completed ?? 0) < (progress?.total ?? Infinity)) {
    return "retrying";
  }
  if (
    status === "dispatching" ||
    status === "provider_running" ||
    status === "running"
  ) {
    return "active";
  }
  return "unknown";
}
