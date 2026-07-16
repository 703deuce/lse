"use client";

import { useSyncExternalStore } from "react";
import {
  compactToLightweight,
  derivePhase,
  hiddenPollIntervalMs,
  isTerminalJobStatus,
  nextPollIntervalMs,
  type CompactJobStatusResponse,
  type LightweightJobStatus,
} from "@/lib/jobs/active-job-status";

type Options = {
  /** Absolute or relative status URL returning LightweightJobStatus-compatible JSON. */
  statusUrl: string | null;
  enabled?: boolean;
  /**
   * Optional terminal detector for feature-status adapters
   * (growth audit, imports) that don't use job_queue statuses.
   */
  isTerminal?: (status: string, json: Record<string, unknown>) => boolean;
  /** Optional mapper when the endpoint is not the compact job-status shape. */
  mapResponse?: (json: Record<string, unknown>) => LightweightJobStatus;
};

type Snapshot = {
  version: number;
  status: LightweightJobStatus | null;
  error: string | null;
};

type CacheEntry = Snapshot & {
  listeners: Set<() => void>;
  inFlight: boolean;
  abort: AbortController | null;
  timeoutId: ReturnType<typeof setTimeout> | null;
  startedAt: number;
  lastChangeAt: number;
  refCount: number;
  onVis: (() => void) | null;
  etag: string | null;
  isTerminal: Options["isTerminal"];
  mapResponse: Options["mapResponse"];
};

const cache = new Map<string, CacheEntry>();
const emptySnapshot: Snapshot = { version: 0, status: null, error: null };

function getEntry(url: string): CacheEntry {
  let entry = cache.get(url);
  if (!entry) {
    entry = {
      version: 0,
      status: null,
      error: null,
      listeners: new Set(),
      inFlight: false,
      abort: null,
      timeoutId: null,
      startedAt: Date.now(),
      lastChangeAt: Date.now(),
      refCount: 0,
      onVis: null,
      etag: null,
      isTerminal: undefined,
      mapResponse: undefined,
    };
    cache.set(url, entry);
  }
  return entry;
}

function bump(entry: CacheEntry) {
  entry.version += 1;
  for (const l of entry.listeners) l();
}

function schedule(url: string, ms: number) {
  const entry = getEntry(url);
  if (entry.timeoutId) clearTimeout(entry.timeoutId);
  entry.timeoutId = setTimeout(() => {
    void tick(url);
  }, ms);
}

function terminalFor(entry: CacheEntry, status: string, json: Record<string, unknown>): boolean {
  if (entry.isTerminal) return entry.isTerminal(status, json);
  return isTerminalJobStatus(status);
}

function defaultMap(json: Record<string, unknown>): LightweightJobStatus {
  // New compact shape
  if (typeof json.version === "number" || "completedUnits" in json) {
    const compact = {
      jobId: String(json.jobId ?? json.id ?? ""),
      jobType: (json.jobType as string | null) ?? null,
      status: String(json.status ?? "unknown"),
      phase: (json.phase as CompactJobStatusResponse["phase"]) ?? "unknown",
      progress: (json.progress as number | null) ?? null,
      completedUnits: (json.completedUnits as number | null) ?? null,
      totalUnits: (json.totalUnits as number | null) ?? null,
      failedUnits: (json.failedUnits as number | null) ?? null,
      updatedAt: (json.updatedAt as string | null) ?? null,
      version: Number(json.version ?? 0),
      errorMessage: (json.errorMessage as string | null) ?? null,
      result: json.result,
    } satisfies CompactJobStatusResponse;
    // Prefer nested progress object when present (compat).
    if (json.progress && typeof json.progress === "object") {
      const p = json.progress as LightweightJobStatus["progress"];
      return {
        jobId: compact.jobId,
        status: compact.status,
        phase: derivePhase(compact.status, p),
        jobType: compact.jobType,
        progress: p,
        result: json.result ?? p?.result ?? null,
        updatedAt: compact.updatedAt,
        errorMessage: compact.errorMessage,
        version: compact.version,
      };
    }
    return compactToLightweight(compact);
  }

  const progress = json.progress as LightweightJobStatus["progress"];
  return {
    jobId: String(json.jobId ?? json.id ?? ""),
    status: String(json.status ?? "unknown"),
    phase: derivePhase(String(json.status ?? "unknown"), progress),
    progress,
    result: json.result ?? progress?.result ?? null,
    updatedAt: (json.updatedAt as string | null) ?? null,
    errorMessage: (json.errorMessage as string | null) ?? null,
    version: typeof json.version === "number" ? json.version : null,
  };
}

async function tick(url: string) {
  const entry = getEntry(url);
  if (entry.refCount <= 0) return;

  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    // Pause hard while hidden — next visibilitychange triggers immediate reconcile.
    schedule(url, hiddenPollIntervalMs());
    return;
  }

  if (entry.inFlight) return;
  if (entry.status && terminalFor(entry, entry.status.status, {})) return;

  entry.inFlight = true;
  entry.abort?.abort();
  entry.abort = new AbortController();
  try {
    const headers: Record<string, string> = { Accept: "application/json" };
    if (entry.etag) headers["If-None-Match"] = entry.etag;

    const res = await fetch(url, {
      signal: entry.abort.signal,
      headers,
    });

    if (res.status === 304) {
      schedule(url, nextPollIntervalMs(entry.startedAt, entry.lastChangeAt));
      return;
    }

    const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      const message = String(json.error ?? `Status ${res.status}`);
      if (res.status === 429) {
        const retry =
          typeof json.retryAfterMs === "number" ? json.retryAfterMs : 1000;
        schedule(url, retry);
        return;
      }
      if (res.status === 401 || res.status === 403 || res.status === 404) {
        entry.error = message;
        entry.status = {
          jobId: String(json.jobId ?? url),
          status: "failed",
          phase: "failed",
          errorMessage: message,
        };
        bump(entry);
        return;
      }
      throw new Error(message);
    }

    const etag = res.headers.get("etag");
    if (etag) entry.etag = etag;

    const mapped = entry.mapResponse ? entry.mapResponse(json) : defaultMap(json);
    const changed =
      mapped.status !== entry.status?.status ||
      mapped.updatedAt !== entry.status?.updatedAt ||
      mapped.version !== entry.status?.version ||
      mapped.progress?.completed !== entry.status?.progress?.completed;

    entry.status = mapped;
    entry.error = null;
    if (changed) entry.lastChangeAt = Date.now();
    bump(entry);

    if (!terminalFor(entry, mapped.status, json)) {
      schedule(url, nextPollIntervalMs(entry.startedAt, entry.lastChangeAt));
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") return;
    entry.error = err instanceof Error ? err.message : "Status poll failed";
    bump(entry);
    schedule(url, nextPollIntervalMs(entry.startedAt, entry.lastChangeAt));
  } finally {
    entry.inFlight = false;
  }
}

function subscribe(
  url: string,
  onStoreChange: () => void,
  options: Pick<Options, "isTerminal" | "mapResponse">
) {
  const entry = getEntry(url);
  entry.isTerminal = options.isTerminal;
  entry.mapResponse = options.mapResponse;
  entry.listeners.add(onStoreChange);
  entry.refCount += 1;
  if (entry.refCount === 1) {
    entry.startedAt = Date.now();
    entry.lastChangeAt = Date.now();
    entry.etag = null;
    void tick(url);
    entry.onVis = () => {
      if (document.visibilityState === "visible" && entry.refCount > 0) {
        // Immediate reconciliation when the tab wakes.
        void tick(url);
      }
    };
    document.addEventListener("visibilitychange", entry.onVis);
  }
  return () => {
    entry.listeners.delete(onStoreChange);
    entry.refCount -= 1;
    if (entry.refCount <= 0) {
      if (entry.timeoutId) clearTimeout(entry.timeoutId);
      entry.abort?.abort();
      if (entry.onVis) document.removeEventListener("visibilitychange", entry.onVis);
      cache.delete(url);
    }
  };
}

/**
 * Poll a lightweight job/feature status endpoint only while active.
 * Deduplicates across components watching the same URL. Stops on terminal
 * status, unmount, and pauses when the tab is hidden.
 */
export function useActiveJobStatus(options: Options): {
  status: LightweightJobStatus | null;
  error: string | null;
  isPolling: boolean;
} {
  const enabled = options.enabled !== false && Boolean(options.statusUrl);
  const url = enabled ? options.statusUrl! : null;
  const isTerminal = options.isTerminal;
  const mapResponse = options.mapResponse;

  const snap = useSyncExternalStore(
    (onChange) =>
      url ? subscribe(url, onChange, { isTerminal, mapResponse }) : () => {},
    () => {
      if (!url) return emptySnapshot;
      const e = getEntry(url);
      return { version: e.version, status: e.status, error: e.error };
    },
    () => emptySnapshot
  );

  const terminal = snap.status
    ? isTerminal
      ? isTerminal(snap.status.status, {})
      : isTerminalJobStatus(snap.status.status)
    : false;

  return {
    status: snap.status,
    error: snap.error,
    isPolling: Boolean(url && snap.status && !terminal),
  };
}
