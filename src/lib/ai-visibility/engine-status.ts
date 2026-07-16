import type { EngineResultStatus } from "@/lib/ai-visibility/types";

/** Runs that produced usable visibility data (full or partial). */
export function isSuccessfulAiRunStatus(status: string): boolean {
  return status === "complete" || status === "completed_with_errors";
}

export function classifyEngineFailure(error: string): {
  status: EngineResultStatus;
  retryAfterMs: number | null;
} {
  const msg = error.toLowerCase();

  if (
    msg.includes("unsupported engine") ||
    msg.includes("not served by") ||
    msg.includes("not supported")
  ) {
    return { status: "unsupported", retryAfterMs: null };
  }

  if (
    msg.includes("not configured") ||
    msg.includes("requires ") ||
    msg.includes("add to .env")
  ) {
    return { status: "skipped", retryAfterMs: null };
  }

  if (
    msg.includes("429") ||
    msg.includes("rate limit") ||
    msg.includes("too many requests") ||
    msg.includes("concurrency") ||
    msg.includes("resource exhausted")
  ) {
    const retryAfterMs = 5_000 + Math.floor(Math.random() * 5_000);
    return { status: "rate_limited", retryAfterMs };
  }

  if (
    msg.includes("timeout") ||
    msg.includes("timed out") ||
    msg.includes("aborted") ||
    msg.includes("etimedout") ||
    msg.includes("deadline")
  ) {
    return { status: "timed_out", retryAfterMs: 3_000 };
  }

  return { status: "provider_failed", retryAfterMs: null };
}

export function engineStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "complete":
      return "Completed";
    case "rate_limited":
      return "Rate limited";
    case "timed_out":
      return "Timed out";
    case "provider_failed":
      return "Provider failed";
    case "unsupported":
      return "Unsupported";
    case "skipped":
      return "Skipped";
    case "failed":
      return "Failed";
    default:
      return "Unknown";
  }
}

export function isEngineFailureStatus(status: string | null | undefined): boolean {
  return (
    status === "failed" ||
    status === "rate_limited" ||
    status === "timed_out" ||
    status === "provider_failed" ||
    status === "unsupported" ||
    status === "skipped"
  );
}
