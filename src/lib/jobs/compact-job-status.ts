/**
 * Compact, tenant-authorized job status reads for adaptive polling.
 * Cache + in-process single-flight; never loads child rows or provider JSON.
 */

import { createServiceClient } from "@/lib/db/client";
import { getCache, tenantCacheKey } from "@/lib/cache";
import {
  derivePhase,
  type CompactJobStatusResponse,
} from "@/lib/jobs/active-job-status";

const CACHE_TTL_MS = 2_000;
const STATUS_COLUMNS =
  "id, job_type, status, enqueue_state, queue_name, organization_id, business_id, progress_json, error_message, scheduled_at, started_at, finished_at, heartbeat_at, created_at";

type CompactRow = {
  id: string;
  job_type: string;
  status: string;
  enqueue_state: string | null;
  queue_name: string | null;
  organization_id: string | null;
  business_id: string | null;
  progress_json: Record<string, unknown> | null;
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

function computeVersion(row: CompactRow): number {
  const stamp =
    row.heartbeat_at ||
    row.finished_at ||
    row.started_at ||
    row.scheduled_at ||
    row.created_at ||
    "";
  const progress = row.progress_json ?? {};
  const completed = Number(progress.completed ?? 0);
  const failed = Number(progress.failed ?? 0);
  let h = 0;
  const raw = `${row.id}|${row.status}|${row.enqueue_state}|${stamp}|${completed}|${failed}`;
  for (let i = 0; i < raw.length; i++) h = (h * 31 + raw.charCodeAt(i)) >>> 0;
  return h;
}

function rowToCompact(row: CompactRow): CompactJobStatusResponse {
  const progress = (row.progress_json ?? {}) as {
    completed?: number;
    total?: number;
    failed?: number;
    percent?: number;
    result?: unknown;
  };
  const completed = progress.completed ?? null;
  const total = progress.total ?? null;
  const failed = progress.failed ?? null;
  let percent = progress.percent ?? null;
  if (percent == null && completed != null && total != null && total > 0) {
    percent = Math.round((completed / total) * 100);
  }
  const updatedAt =
    row.heartbeat_at ?? row.finished_at ?? row.started_at ?? row.scheduled_at ?? null;

  return {
    jobId: row.id,
    jobType: row.job_type ?? null,
    status: row.status,
    phase: derivePhase(row.status, {
      completed: completed ?? undefined,
      total: total ?? undefined,
      failed: failed ?? undefined,
    }),
    progress: percent,
    completedUnits: completed,
    totalUnits: total,
    failedUnits: failed,
    updatedAt,
    version: computeVersion(row),
    errorMessage: row.error_message,
    result: progress.result ?? undefined,
    enqueueState: row.enqueue_state,
    queueName: row.queue_name,
  };
}

async function loadCompactFromDb(jobId: string): Promise<CompactJobStatusBundle | null> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("job_queue")
    .select(STATUS_COLUMNS)
    .eq("id", jobId)
    .maybeSingle();
  if (error || !data) return null;
  const row = data as unknown as CompactRow;
  return {
    compact: rowToCompact(row),
    organizationId: row.organization_id,
    businessId: row.business_id,
    cacheHit: false,
  };
}

function cacheKeyForJob(jobId: string): string {
  return tenantCacheKey("platform", "job-status", jobId);
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
      const cache = getCache();
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
      const cache = getCache();
      await cache.set(
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
