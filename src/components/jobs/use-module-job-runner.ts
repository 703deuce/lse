"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useActiveJobStatus } from "@/components/jobs/use-active-job-status";

type RunResult = {
  queued?: boolean;
  jobId?: string;
  status?: string;
  [key: string]: unknown;
};

type Options = {
  /** Called after a terminal job status (or sync completion). */
  onSettled?: () => void | Promise<void>;
};

/**
 * Shared pattern for module dashboards:
 * 1. POST a run endpoint that returns { queued, jobId }
 * 2. Poll lightweight /api/jobs/[jobId]/status while active
 * 3. Reload module data once when the job settles
 */
export function useModuleJobRunner(options: Options = {}) {
  const [jobId, setJobId] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onSettledRef = useRef(options.onSettled);
  onSettledRef.current = options.onSettled;

  const { status, error: pollError, isPolling } = useActiveJobStatus({
    statusUrl: jobId ? `/api/jobs/${jobId}/status` : null,
    enabled: Boolean(jobId),
  });

  useEffect(() => {
    if (!jobId || !status) return;
    const terminal =
      status.status === "completed" ||
      status.status === "failed" ||
      status.status === "canceled" ||
      status.status === "cancelled";
    if (!terminal) return;
    setRunning(false);
    void Promise.resolve(onSettledRef.current?.()).finally(() => {
      setJobId(null);
    });
  }, [jobId, status]);

  useEffect(() => {
    if (pollError) setError(pollError);
  }, [pollError]);

  const start = useCallback(async (url: string, body: Record<string, unknown>, failMessage = "Run failed") => {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as RunResult & { error?: string };
      if (!res.ok) throw new Error(json.error ?? failMessage);

      if (json.queued && typeof json.jobId === "string") {
        setJobId(json.jobId);
        return json;
      }

      await onSettledRef.current?.();
      setRunning(false);
      return json;
    } catch (e) {
      setError(e instanceof Error ? e.message : failMessage);
      setRunning(false);
      throw e;
    }
  }, []);

  return {
    start,
    running: running || isPolling,
    error,
    setError,
    jobId,
    jobStatus: status,
  };
}
