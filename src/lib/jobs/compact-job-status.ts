/**
 * Compact, tenant-authorized job status reads for adaptive polling.
 * Cache + in-process single-flight; never loads child rows or provider JSON.
 */

import { createServiceClient } from "@/lib/db/client";
import { getCache, getCacheDriverName, tenantCacheKey } from "@/lib/cache";
import { createMemoryCache } from "@/lib/cache/drivers";
import type { CacheDriver } from "@/lib/cache/types";
import {
  derivePhase,
  type CompactJobStatusResponse,
} from "@/lib/jobs/active-job-status";
import { customerSafeScanError } from "@/lib/scans/customer-safe-error";

const CACHE_TTL_MS = 2_000;
/** Running jobs with heartbeat older than this are surfaced as stalled. */
const STALE_HEARTBEAT_MS = Number(process.env.JOB_STALE_HEARTBEAT_MS ?? 120_000);
const STATUS_COLUMNS =
  "id, job_type, status, enqueue_state, queue_name, organization_id, business_id, progress_json, progress_version, progress_total, progress_completed, progress_failed, error_message, scheduled_at, started_at, finished_at, heartbeat_at, created_at";

/** Fallback when migration 060 (progress_version) is not applied yet. */
const STATUS_COLUMNS_LEGACY =
  "id, job_type, status, enqueue_state, queue_name, organization_id, business_id, progress_json, progress_total, progress_completed, progress_failed, error_message, scheduled_at, started_at, finished_at, heartbeat_at, created_at";

type CompactRow = {
  id: string;
  job_type: string;
  status: string;
  enqueue_state: string | null;
  queue_name: string | null;
  organization_id: string | null;
  business_id: string | null;
  progress_json: Record<string, unknown> | null;
  progress_version?: number | null;
  progress_total?: number | null;
  progress_completed?: number | null;
  progress_failed?: number | null;
  error_message: string | null;
  scheduled_at: string;
  started_at: string | null;
  finished_at: string | null;
  heartbeat_at: string | null;
  created_at?: string | null;
};

export type CompactJobStatusBundle = {
  compact: CompactJobStatusResponse;
  organizationId: string | null;
  businessId: string | null;
  cacheHit: boolean;
};

const inFlight = new Map<string, Promise<CompactJobStatusBundle | null>>();

/** Per-process rate limit: orgId:jobId → recent timestamps. */
const rateBuckets = new Map<string, number[]>();

export function assertJobStatusRateLimit(params: {
  organizationId: string;
  jobId: string;
  maxPerWindow?: number;
  windowMs?: number;
}): { ok: true } | { ok: false; retryAfterMs: number } {
  const max = params.maxPerWindow ?? 2;
  const windowMs = params.windowMs ?? 1000;
  const key = `${params.organizationId}:${params.jobId}`;
  const now = Date.now();
  const prev = (rateBuckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (prev.length >= max) {
    const retryAfterMs = Math.max(50, windowMs - (now - (prev[0] ?? now)));
    rateBuckets.set(key, prev);
    return { ok: false, retryAfterMs };
  }
  prev.push(now);
  rateBuckets.set(key, prev);
  if (rateBuckets.size > 5_000) {
    for (const [k, times] of rateBuckets) {
      const kept = times.filter((t) => now - t < windowMs);
      if (!kept.length) rateBuckets.delete(k);
      else rateBuckets.set(k, kept);
    }
  }
  return { ok: true };
}

/** Exported for unit tests — running jobs with stale heartbeat are soft-stalled. */
export function isJobHeartbeatStale(
  row: { status: string; heartbeat_at?: string | null; started_at?: string | null },
  now = Date.now(),
  staleMs = STALE_HEARTBEAT_MS
): boolean {
  if (row.status !== "running") return false;
  const hb = row.heartbeat_at || row.started_at;
  if (!hb) return true;
  const ts = new Date(hb).getTime();
  if (!Number.isFinite(ts)) return true;
  return now - ts > staleMs;
}

function rowToCompact(row: CompactRow): CompactJobStatusResponse {
  const progress = (row.progress_json ?? {}) as {
    completed?: number;
    total?: number;
    failed?: number;
    percent?: number;
    result?: unknown;
  };
  const completed = row.progress_completed ?? progress.completed ?? null;
  const total = row.progress_total ?? progress.total ?? null;
  const failed = row.progress_failed ?? progress.failed ?? null;
  let percent = progress.percent ?? null;
  if (percent == null && completed != null && total != null && total > 0) {
    percent = Math.round((completed / total) * 100);
  }
  const updatedAt =
    row.heartbeat_at ?? row.finished_at ?? row.started_at ?? row.scheduled_at ?? null;
  const stalled = isJobHeartbeatStale(row);
  // Keep DB status (`running`) so existing clients stay compatible; expose `stalled`
  // as a soft ops/UI signal and map phase to retrying while the lease may recover.
  const phase = stalled
    ? "retrying"
    : derivePhase(row.status, {
        completed: completed ?? undefined,
        total: total ?? undefined,
        failed: failed ?? undefined,
      });

  return {
    jobId: row.id,
    jobType: row.job_type ?? null,
    status: row.status,
    phase,
    progress: percent,
    completedUnits: completed,
    totalUnits: total,
    failedUnits: failed,
    updatedAt,
    version: Number(row.progress_version ?? 0),
    errorMessage: stalled
      ? customerSafeScanError(
          row.error_message ||
            "Worker heartbeat is stale — the job may be recovering automatically."
        )
      : customerSafeScanError(row.error_message),
    result: progress.result ?? undefined,
    enqueueState: row.enqueue_state,
    queueName: row.queue_name,
    stalled,
  };
}

async function loadCompactFromDb(jobId: string): Promise<CompactJobStatusBundle | null> {
  const supabase = createServiceClient();
  const primary = await supabase
    .from("job_queue")
    .select(STATUS_COLUMNS)
    .eq("id", jobId)
    .maybeSingle();

  let row: CompactRow | null = null;
  if (!primary.error && primary.data) {
    row = primary.data as unknown as CompactRow;
  } else if (primary.error) {
    // Schema lag: progress_version missing → entire select failed → UI got 404
    // "Job not found" while the worker was still processing the job.
    const legacy = await supabase
      .from("job_queue")
      .select(STATUS_COLUMNS_LEGACY)
      .eq("id", jobId)
      .maybeSingle();
    if (legacy.error || !legacy.data) return null;
    row = legacy.data as unknown as CompactRow;
  } else {
    return null;
  }

  return {
    compact: rowToCompact(row),
    organizationId: row.organization_id,
    businessId: row.business_id,
    cacheHit: false,
  };
}

function cacheKeyForJob(jobId: string): string {
  // Job UUIDs are globally unique; authZ still checks organizationId after read.
  return tenantCacheKey("platform", "job-status", jobId);
}

/** Memory fallback so status coalescing works even when CACHE_DRIVER=none. */
let memoryStatusCache: CacheDriver | null = null;

function statusCache(): CacheDriver {
  const driver = getCacheDriverName();
  if (driver === "redis" || driver === "memory") return getCache();
  if (!memoryStatusCache) memoryStatusCache = createMemoryCache();
  return memoryStatusCache;
}

/**
 * Single-flight + short cache. Caller must authorize using organizationId.
 */
export async function getCompactJobStatus(
  jobId: string
): Promise<CompactJobStatusBundle | null> {
  const flightKey = `job-status:${jobId}`;
  const existing = inFlight.get(flightKey);
  if (existing) return existing;

  const promise = (async (): Promise<CompactJobStatusBundle | null> => {
    try {
      const cache = statusCache();
      const key = cacheKeyForJob(jobId);
      const cached = await cache.get<Omit<CompactJobStatusBundle, "cacheHit">>(key);
      if (cached?.compact?.jobId) {
        return { ...cached, cacheHit: true };
      }
    } catch {
      /* miss */
    }

    const loaded = await loadCompactFromDb(jobId);
    if (!loaded) return null;

    try {
      await statusCache().set(
        cacheKeyForJob(jobId),
        {
          compact: loaded.compact,
          organizationId: loaded.organizationId,
          businessId: loaded.businessId,
        },
        { ttlMs: CACHE_TTL_MS }
      );
    } catch {
      /* best-effort */
    }

    return loaded;
  })();

  inFlight.set(flightKey, promise);
  try {
    return await promise;
  } finally {
    inFlight.delete(flightKey);
  }
}

/** Test helper */
export function resetJobStatusRateLimitsForTests(): void {
  rateBuckets.clear();
  inFlight.clear();
}
