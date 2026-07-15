"use client";

import { useSyncExternalStore } from "react";
import {
  derivePhase,
  isTerminalJobStatus,
  nextPollIntervalMs,
  type LightweightJobStatus,
} from "@/lib/jobs/active-job-status";

type Options = {
  /** Absolute or relative status URL returning LightweightJobStatus-compatible JSON. */
  statusUrl: string | null;
  enabled?: boolean;
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

async function tick(url: string) {
  const entry = getEntry(url);
  if (entry.refCount <= 0) return;
  if (typeof document !== "undefined" && document.visibilityState === "hidden") {
    schedule(url, 5000);
    return;
  }
  if (entry.inFlight) return;
  if (entry.status && isTerminalJobStatus(entry.status.status)) return;

  entry.inFlight = true;
  entry.abort?.abort();
  entry.abort = new AbortController();
  try {
    const res = await fetch(url, {
      signal: entry.abort.signal,
      headers: { Accept: "application/json" },
    });
    const json = (await res.json()) as Record<string, unknown>;
    if (!res.ok) {
      const message = String(json.error ?? `Status ${res.status}`);
      // Stop forever-polls on auth / missing jobs.
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
    const progress = json.progress as LightweightJobStatus["progress"];
    const mapped: LightweightJobStatus = {
      jobId: String(json.jobId ?? json.id ?? url),
      status: String(json.status ?? "unknown"),
      phase: derivePhase(String(json.status ?? "unknown"), progress),
      progress,
      updatedAt: (json.updatedAt as string | null) ?? null,
      errorMessage: (json.errorMessage as string | null) ?? null,
    };
    const changed =
      mapped.status !== entry.status?.status ||
      mapped.updatedAt !== entry.status?.updatedAt ||
      mapped.progress?.completed !== entry.status?.progress?.completed;
    entry.status = mapped;
    entry.error = null;
    if (changed) entry.lastChangeAt = Date.now();
    bump(entry);
    if (!isTerminalJobStatus(mapped.status)) {
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

function subscribe(url: string, onStoreChange: () => void) {
  const entry = getEntry(url);
  entry.listeners.add(onStoreChange);
  entry.refCount += 1;
  if (entry.refCount === 1) {
    entry.startedAt = Date.now();
    entry.lastChangeAt = Date.now();
    void tick(url);
    entry.onVis = () => {
      if (document.visibilityState === "visible" && entry.refCount > 0) {
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
 * Poll a lightweight job status endpoint only while the job is active.
 * Deduplicates across components watching the same URL. Stops on terminal
 * status, unmount, and slows/pauses when the tab is hidden.
 */
export function useActiveJobStatus(options: Options): {
  status: LightweightJobStatus | null;
  error: string | null;
  isPolling: boolean;
} {
  const enabled = options.enabled !== false && Boolean(options.statusUrl);
  const url = enabled ? options.statusUrl! : null;

  const snap = useSyncExternalStore(
    (onChange) => (url ? subscribe(url, onChange) : () => {}),
    () => {
      if (!url) return emptySnapshot;
      const e = getEntry(url);
      return { version: e.version, status: e.status, error: e.error };
    },
    () => emptySnapshot
  );

  return {
    status: snap.status,
    error: snap.error,
    isPolling: Boolean(
      url && snap.status && !isTerminalJobStatus(snap.status.status)
    ),
  };
}
