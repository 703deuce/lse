import pLimit from "p-limit";
import { createServiceClient } from "@/lib/db/client";
import { extractTopCompetitors, type MapsLiveResult } from "@/lib/providers/dataforseo";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { matchTargetInResults } from "@/lib/providers/dataforseo/match-target";
import { mapsGridCell } from "@/lib/providers/brightdata";
import {
  elapsedSec,
  logCellPhaseTimings,
  softReadyMinSuccess,
  type CellPhaseTimings,
} from "@/lib/jobs/scan-cell-benchmark";
import { saveCellTelemetry } from "@/lib/jobs/scan-cell-telemetry";
import { refreshScanAggregateMetrics } from "@/lib/jobs/refresh-scan-metrics";
import { mergeScanConfidenceSummary } from "@/lib/jobs/merge-confidence-summary";
import {
  isRetryableCellSerpError,
  validateLiveCellSerp,
  validateStoredCellResult,
} from "@/lib/maps/cell-result-integrity";
import { invalidateScanGridCache } from "@/lib/maps/scan-queries";

/** Bright Data global fair-use ~100 QPS — primary pass runs in batches of this size. */
const BRIGHTDATA_GRID_BATCH_SIZE = 100;

export function mapsDepth(): number {
  const n = Number(
    process.env.BRIGHTDATA_MAPS_DEPTH ??
      process.env.SCRAPINGDOG_MAPS_DEPTH ??
      LOCAL_FALCON_PARITY.gridDepth
  );
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : LOCAL_FALCON_PARITY.gridDepth;
}

export function mapsCellBatchSize(): number {
  const n = Number(
    process.env.BRIGHTDATA_GRID_BATCH_SIZE ??
      process.env.BRIGHTDATA_BURST_MAX_CONCURRENCY ??
      BRIGHTDATA_GRID_BATCH_SIZE
  );
  return Number.isFinite(n) && n > 0 ? n : BRIGHTDATA_GRID_BATCH_SIZE;
}

export function mapsGridConcurrency(cellCount: number): number {
  return Math.min(cellCount, mapsCellBatchSize());
}

export function mapsGridCellTimeoutMs(): number {
  const n = Number(
    process.env.BRIGHTDATA_GRID_CELL_TIMEOUT_MS ??
      process.env.BRIGHTDATA_BURST_CELL_TIMEOUT_MS ??
      45000
  );
  return Number.isFinite(n) && n > 0 ? n : 45000;
}

export function mapsGridMaxRetryRounds(): number {
  const n = Number(
    process.env.BRIGHTDATA_GRID_RETRY_ROUNDS ??
      process.env.BRIGHTDATA_BURST_CELL_MAX_ATTEMPTS ??
      3
  );
  return Number.isFinite(n) && n > 0 ? Math.min(n, 5) : 3;
}

export function mapsGridRetryDelayMs(): number {
  const n = Number(
    process.env.BRIGHTDATA_GRID_RETRY_DELAY_MS ??
      process.env.BRIGHTDATA_BURST_RETRY_DELAY_MS ??
      1000
  );
  return Number.isFinite(n) && n >= 0 ? n : 1000;
}

function parityDebug(): boolean {
  return process.env.GRID_PARITY_DEBUG === "true";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`Cell timeout after ${ms}ms (${label})`)), ms);
    promise
      .then((v) => {
        clearTimeout(timer);
        resolve(v);
      })
      .catch((e) => {
        clearTimeout(timer);
        reject(e);
      });
  });
}

function isRetryableError(err: Error): boolean {
  const msg = err.message.toLowerCase();
  return (
    isRetryableCellSerpError(msg) ||
    msg.includes("timeout") ||
    msg.includes("429") ||
    msg.includes("rate") ||
    msg.includes("throttl") ||
    msg.includes("no map results") ||
    msg.includes("empty") ||
    msg.includes("502") ||
    msg.includes("503")
  );
}

export type GridCellJob = {
  scanBatchId: string;
  point: {
    id: string;
    grid_label: string;
    lat: number;
    lng: number;
    distance_from_center_m?: number;
  };
  keyword: { id: string; keyword: string };
  business: {
    cid?: string | null;
    place_id?: string | null;
    name?: string | null;
    address_text?: string | null;
    phone?: string | null;
    website_url?: string | null;
  };
  device: string;
  os: string;
  browser: string;
  organizationId?: string;
};

export type GridCellRunResult = {
  success: boolean;
  pointId: string;
  keywordId: string;
  gridLabel: string;
  timings?: CellPhaseTimings;
  timedOut?: boolean;
};

async function saveCellProgress(
  scanBatchId: string,
  completed: number,
  total: number,
  failed: number,
  extra?: Record<string, unknown>
) {
  const supabase = createServiceClient();
  const failedPointIds = Array.isArray(extra?.failed_point_ids)
    ? (extra.failed_point_ids as string[])
    : [];

  // Never let a retry/integrity pass rewind the public counter — that made the
  // wait UI jump to 49 then drop back to ~47 while late flushes landed.
  const { data: existing } = await supabase
    .from("scan_batches")
    .select("cells_completed, cells_total, confidence_summary")
    .eq("id", scanBatchId)
    .maybeSingle();
  const conf = (existing?.confidence_summary ?? {}) as Record<string, unknown>;
  const prevCompleted = Math.max(
    Number(existing?.cells_completed ?? 0),
    Number(conf.completed_cells ?? 0)
  );
  const prevTotal = Math.max(
    Number(existing?.cells_total ?? 0),
    Number(conf.total_cells ?? 0),
    total
  );
  const safeCompleted = Math.max(prevCompleted, completed);
  const safeTotal = Math.max(prevTotal, total);

  const { failed_point_ids: _ignored, ...restExtra } = extra ?? {};
  const patch: Record<string, unknown> = {
    provider: "brightdata",
    method: "live_parallel",
    completed_cells: safeCompleted,
    total_cells: safeTotal,
    failed_cells: failed,
    failed_point_ids: failedPointIds,
    ...restExtra,
  };

  // Counters on columns; confidence keys merge so parallel writers cannot wipe siblings.
  await supabase
    .from("scan_batches")
    .update({
      cells_total: safeTotal,
      cells_completed: safeCompleted,
      cells_failed: failed,
    })
    .eq("id", scanBatchId);

  await mergeScanConfidenceSummary(supabase, scanBatchId, patch);
}

/** Serialize progress writes per scan so parallel cells cannot clobber confidence_summary. */
const progressChains = new Map<string, Promise<void>>();

function enqueueProgressWrite(scanBatchId: string, write: () => Promise<void>): Promise<void> {
  const prev = progressChains.get(scanBatchId) ?? Promise.resolve();
  const next = prev.then(write, write).finally(() => {
    if (progressChains.get(scanBatchId) === next) {
      progressChains.delete(scanBatchId);
    }
  });
  progressChains.set(scanBatchId, next);
  return next;
}

const PROGRESS_FLUSH_MS = Number(process.env.SCAN_PROGRESS_FLUSH_MS ?? 750);

type ProgressThrottleState = {
  lastFlushAt: number;
  pending: {
    completed: number;
    total: number;
    failed: number;
    extra?: Record<string, unknown>;
  } | null;
  flushTimer: ReturnType<typeof setTimeout> | null;
};

const progressThrottleByScan = new Map<string, ProgressThrottleState>();

async function flushPendingProgress(scanBatchId: string, force = false): Promise<void> {
  const state = progressThrottleByScan.get(scanBatchId);
  if (!state?.pending) return;
  const due = force || Date.now() - state.lastFlushAt >= PROGRESS_FLUSH_MS;
  if (!due) return;
  const payload = state.pending;
  state.pending = null;
  state.lastFlushAt = Date.now();
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }
  await enqueueProgressWrite(scanBatchId, () =>
    saveCellProgress(scanBatchId, payload.completed, payload.total, payload.failed, payload.extra)
  );
}

async function scheduleCellProgress(
  scanBatchId: string,
  completed: number,
  total: number,
  failed: number,
  extra?: Record<string, unknown>,
  options?: { force?: boolean }
): Promise<void> {
  let state = progressThrottleByScan.get(scanBatchId);
  if (!state) {
    state = { lastFlushAt: 0, pending: null, flushTimer: null };
    progressThrottleByScan.set(scanBatchId, state);
  }
  // Coalesce with max(completed) so a later flush of an older pass cannot shrink progress.
  const prev = state.pending;
  state.pending = {
    completed: Math.max(prev?.completed ?? 0, completed),
    total: Math.max(prev?.total ?? 0, total),
    failed,
    extra: extra ?? prev?.extra,
  };
  if (options?.force) {
    await flushPendingProgress(scanBatchId, true);
    return;
  }
  const elapsed = Date.now() - state.lastFlushAt;
  if (elapsed >= PROGRESS_FLUSH_MS) {
    await flushPendingProgress(scanBatchId, true);
    return;
  }
  if (!state.flushTimer) {
    state.flushTimer = setTimeout(() => {
      void flushPendingProgress(scanBatchId, true).catch((err) => {
        console.warn("[Scan] throttled progress flush failed", scanBatchId, err);
      });
    }, Math.max(50, PROGRESS_FLUSH_MS - elapsed));
  }
}

async function runOneCell(
  job: GridCellJob,
  depth: number,
  timeoutMs: number,
  maxAttempts: number,
  passLabel: string,
  concurrency: number
): Promise<GridCellRunResult> {
  const supabase = createServiceClient();
  const kw = job.keyword.keyword.trim();
  const lat = job.point.lat;
  const lng = job.point.lng;
  const locationCoordinate = `${lat},${lng},${LOCAL_FALCON_PARITY.locationZoom}`;
  const cellStarted = performance.now();
  let apiSec = 0;
  let matchingSec = 0;
  let dbSaveSec = 0;
  let attemptsUsed = 0;
  let timedOut = false;

  let lastError: Error | null = null;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    attemptsUsed = attempt + 1;
    if (attempt > 0) await sleep(1500 * Math.pow(2, attempt - 1));

    try {
      const apiStart = performance.now();
      const live = await withTimeout(
        mapsGridCell({
          keyword: kw,
          lat,
          lng,
          device: job.device === "mobile" ? "mobile" : "desktop",
          os: (["android", "ios", "windows", "macos"].includes(job.os)
            ? job.os
            : job.device === "mobile"
              ? "android"
              : "windows") as "android" | "ios" | "windows" | "macos",
          browser: job.browser === "firefox" ? "firefox" : "chrome",
          depth,
          organizationId: job.organizationId,
        }),
        timeoutMs,
        job.point.grid_label
      );
      apiSec = elapsedSec(apiStart);

      const items = live.items as MapsLiveResult[];
      const targetInput = {
        cid: job.business.cid,
        place_id: job.business.place_id,
        name: job.business.name,
        address: job.business.address_text,
        phone: job.business.phone,
        website_url: job.business.website_url,
      };
      const serpValidation = validateLiveCellSerp(items, targetInput, depth);
      if (!serpValidation.complete) {
        throw new Error(serpValidation.reason ?? "Incomplete map results for this cell");
      }

      const matchStart = performance.now();
      const match = matchTargetInResults(items, targetInput, items.length);
      matchingSec = elapsedSec(matchStart);

      if (parityDebug()) {
        console.log("[GridParity]", {
          gridLabel: job.point.grid_label,
          attempt: attempt + 1,
          request: live.request,
          itemCount: items.length,
          targetRank: match.rank,
          matchReason: match.matchReason,
        });
      }

      const dbStart = performance.now();
      const resultPayload = {
        scan_point_id: job.point.id,
        keyword_id: job.keyword.id,
        target_rank: match.rank,
        target_found: match.found,
        check_url: null,
        source_timestamp: live.timestamp,
        confidence: match.matchReason,
        top_competitors_json: extractTopCompetitors(items),
        provider_request_json: live.request as unknown as Record<string, unknown>,
      };
      // Unique (scan_point_id, keyword_id) makes retries idempotent — no delete+insert race.
      const { error: upsertError } = await supabase.from("scan_results").upsert(resultPayload, {
        onConflict: "scan_point_id,keyword_id",
        ignoreDuplicates: false,
      });
      if (upsertError) throw new Error(upsertError.message);
      dbSaveSec = elapsedSec(dbStart);
      invalidateScanGridCache(job.scanBatchId);

      const totalSec = elapsedSec(cellStarted);
      const timings: CellPhaseTimings = {
        gridLabel: job.point.grid_label,
        apiSec,
        matchingSec,
        dbSaveSec,
        progressSec: 0,
        totalSec,
        success: true,
        attempts: attemptsUsed,
      };

      void saveCellTelemetry({
        scanBatchId: job.scanBatchId,
        scanPointId: job.point.id,
        keywordId: job.keyword.id,
        gridLabel: job.point.grid_label,
        concurrency,
        apiLatencyMs: apiSec * 1000,
        matchingMs: matchingSec * 1000,
        dbSaveMs: dbSaveSec * 1000,
        totalMs: totalSec * 1000,
        attempts: attemptsUsed,
        success: true,
        timedOut: false,
        distanceFromCenterM: job.point.distance_from_center_m,
        lat,
        lng,
        passLabel,
      });

      return {
        success: true,
        pointId: job.point.id,
        keywordId: job.keyword.id,
        gridLabel: job.point.grid_label,
        timings,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      timedOut = lastError.message.toLowerCase().includes("timeout");
      if (!isRetryableError(lastError) || attempt >= maxAttempts - 1) break;
      console.warn(
        `[Scan] Cell retry grid=${job.point.grid_label} attempt=${attempt + 1}/${maxAttempts}:`,
        lastError.message
      );
    }
  }

  console.error(
    `[Scan] Cell failed grid=${job.point.grid_label} keyword="${kw}" coord=${locationCoordinate}:`,
    lastError?.message
  );

  const totalSec = elapsedSec(cellStarted);
  const timings: CellPhaseTimings = {
    gridLabel: job.point.grid_label,
    apiSec,
    matchingSec,
    dbSaveSec,
    progressSec: 0,
    totalSec,
    success: false,
    attempts: attemptsUsed,
  };

  void saveCellTelemetry({
    scanBatchId: job.scanBatchId,
    scanPointId: job.point.id,
    keywordId: job.keyword.id,
    gridLabel: job.point.grid_label,
    concurrency,
    apiLatencyMs: apiSec * 1000,
    matchingMs: matchingSec * 1000,
    dbSaveMs: dbSaveSec * 1000,
    totalMs: totalSec * 1000,
    attempts: attemptsUsed,
    success: false,
    timedOut,
    errorMessage: lastError?.message,
    distanceFromCenterM: job.point.distance_from_center_m,
    lat,
    lng,
    passLabel,
  });

  return {
    success: false,
    pointId: job.point.id,
    keywordId: job.keyword.id,
    gridLabel: job.point.grid_label,
    timings,
    timedOut,
  };
}

async function runJobsWithConcurrency(
  jobs: GridCellJob[],
  params: {
    scanBatchId: string;
    depth: number;
    timeoutMs: number;
    maxAttempts: number;
    concurrency: number;
    totalCells: number;
    passLabel: string;
    completedOffset?: number;
    softReadyMinSuccess?: number;
    onSoftReady?: () => Promise<void>;
    onCellSettled?: (success: boolean) => Promise<void>;
    updateProgress?: boolean;
    organizationId?: string;
  }
): Promise<{
  results: GridCellRunResult[];
  failedCells: number;
  successCount: number;
  timings: CellPhaseTimings[];
}> {
  const limit = pLimit(params.concurrency);
  const completedOffset = params.completedOffset ?? 0;
  const updateProgress = params.updateProgress !== false;
  let completed = 0;
  let successCount = 0;
  let failedCells = 0;
  let softReadyFired = false;
  let softReadyGate: Promise<void> = Promise.resolve();
  const failedPointIds: string[] = [];
  const timings: CellPhaseTimings[] = [];

  // Serialize soft-ready so parallel settling cells cannot fire onSoftReady twice.
  const maybeSoftReady = async () => {
    if (!params.onSoftReady || !params.softReadyMinSuccess) return;
    const maxTrailing = params.totalCells - params.softReadyMinSuccess;
    const remaining = params.totalCells - completed;
    if (!(remaining <= maxTrailing && completed >= params.softReadyMinSuccess)) return;

    softReadyGate = softReadyGate.then(async () => {
      if (softReadyFired) return;
      softReadyFired = true;
      console.log(
        `[Scan] Soft rank_ready: ${completed}/${params.totalCells} cells done, ${successCount} succeeded, ${remaining} still in flight`
      );
      await params.onSoftReady!();
    });
    await softReadyGate;
  };

  const results = await Promise.all(
    jobs.map((job) =>
      limit(async () => {
        const result = await runOneCell(
          job,
          params.depth,
          params.timeoutMs,
          params.maxAttempts,
          params.passLabel,
          params.concurrency
        );
        completed++;
        if (result.success) {
          successCount++;
          const failedIdx = failedPointIds.indexOf(job.point.id);
          if (failedIdx >= 0) failedPointIds.splice(failedIdx, 1);
        } else {
          failedCells++;
          if (!failedPointIds.includes(job.point.id)) {
            failedPointIds.push(job.point.id);
          }
        }

        const progressStart = performance.now();
        if (updateProgress) {
          // Count successes only — counting every settled (incl. failed) cell made the
          // bar hit 100% at the end of primary while retries still had 10+ seconds left.
          await scheduleCellProgress(
            params.scanBatchId,
            Math.min(completedOffset + successCount, params.totalCells),
            params.totalCells,
            failedCells,
            { pass: params.passLabel, failed_point_ids: [...new Set(failedPointIds)] }
          );
        }
        const progressSec = elapsedSec(progressStart);

        if (result.timings) {
          timings.push({ ...result.timings, progressSec });
        }

        await maybeSoftReady();
        await params.onCellSettled?.(result.success);

        return result;
      })
    )
  );

  if (updateProgress) {
    await scheduleCellProgress(
      params.scanBatchId,
      Math.min(completedOffset + successCount, params.totalCells),
      params.totalCells,
      failedCells,
      { pass: params.passLabel, failed_point_ids: [...new Set(failedPointIds)] },
      { force: true }
    );
  }

  return { results, failedCells, successCount, timings };
}

function chunkJobs<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

function buildGridCellJobs(
  params: Pick<
    GridCellJob,
    "scanBatchId" | "business" | "device" | "os" | "browser" | "organizationId"
  > & {
    points: GridCellJob["point"][];
    keywords: GridCellJob["keyword"][];
  }
): GridCellJob[] {
  const jobs: GridCellJob[] = [];
  for (const keyword of params.keywords) {
    for (const point of params.points) {
      jobs.push({
        scanBatchId: params.scanBatchId,
        point,
        keyword: { id: keyword.id, keyword: keyword.keyword.trim() },
        business: params.business,
        device: params.device,
        os: params.os,
        browser: params.browser,
        organizationId: params.organizationId,
      });
    }
  }
  return jobs;
}

function failedJobsFromPass(jobs: GridCellJob[], results: GridCellRunResult[]): GridCellJob[] {
  return jobs.filter((job) =>
    results.some((r) => !r.success && r.pointId === job.point.id && r.keywordId === job.keyword.id)
  );
}

async function runIntegrityPass(params: {
  scanBatchId: string;
  jobs: GridCellJob[];
  depth: number;
  timeoutMs: number;
  maxAttempts: number;
  concurrency: number;
  totalCells: number;
  organizationId?: string;
  onCellSettled?: (success: boolean) => Promise<void>;
}): Promise<{
  failedCells: number;
  failedPointIds: string[];
  timings: CellPhaseTimings[];
  successCount: number;
}> {
  const supabase = createServiceClient();
  const { data: pointRows } = await supabase
    .from("scan_points")
    .select("id")
    .eq("scan_batch_id", params.scanBatchId);
  const savedPointIds = (pointRows ?? []).map((p) => p.id as string);
  const { data: savedResults } = savedPointIds.length
    ? await supabase
        .from("scan_results")
        .select("scan_point_id, keyword_id, target_found, top_competitors_json")
        .in("scan_point_id", savedPointIds)
    : { data: [] };

  const incompleteJobs = params.jobs.filter((job) => {
    const row = (savedResults ?? []).find(
      (r) => r.scan_point_id === job.point.id && r.keyword_id === job.keyword.id
    );
    return !validateStoredCellResult(row, params.depth).complete;
  });

  if (!incompleteJobs.length) {
    return { failedCells: 0, failedPointIds: [], timings: [], successCount: 0 };
  }

  console.log(
    `[Scan] Integrity retry for ${incompleteJobs.length} sparse/incomplete cells (concurrency=${params.concurrency})`
  );
  const integrityPass = await runJobsWithConcurrency(incompleteJobs, {
    scanBatchId: params.scanBatchId,
    depth: params.depth,
    timeoutMs: params.timeoutMs,
    maxAttempts: params.maxAttempts,
    concurrency: params.concurrency,
    totalCells: params.totalCells,
    passLabel: "integrity",
    completedOffset: Math.max(0, params.totalCells - incompleteJobs.length),
    updateProgress: true,
    onCellSettled: params.onCellSettled,
    organizationId: params.organizationId,
  });

  const { data: refreshedResults } = savedPointIds.length
    ? await supabase
        .from("scan_results")
        .select("scan_point_id, keyword_id, target_found, top_competitors_json")
        .in("scan_point_id", savedPointIds)
    : { data: [] };

  const stillIncompleteIds = incompleteJobs
    .filter((job) => {
      const row = (refreshedResults ?? []).find(
        (r) => r.scan_point_id === job.point.id && r.keyword_id === job.keyword.id
      );
      return !validateStoredCellResult(row, params.depth).complete;
    })
    .map((job) => job.point.id);

  // Replace — do not union with previous failed ids (recovered cells would stay marked failed).
  await scheduleCellProgress(
    params.scanBatchId,
    params.totalCells,
    params.totalCells,
    stillIncompleteIds.length,
    {
      pass: "integrity",
      failed_point_ids: stillIncompleteIds,
      sparse_point_ids: stillIncompleteIds,
      integrity_retries: incompleteJobs.length,
      integrity_recovered: incompleteJobs.length - stillIncompleteIds.length,
    },
    { force: true }
  );
  invalidateScanGridCache(params.scanBatchId);
  console.log(
    `[Scan] Integrity retry recovered ${incompleteJobs.length - stillIncompleteIds.length}/${incompleteJobs.length} cells; ${stillIncompleteIds.length} still sparse`
  );

  return {
    failedCells: stillIncompleteIds.length,
    failedPointIds: stillIncompleteIds,
    timings: integrityPass.timings,
    successCount: integrityPass.successCount,
  };
}

export async function runGridCellsLive(params: {
  scanBatchId: string;
  points: Array<{
    id: string;
    grid_label: string;
    lat: number;
    lng: number;
    distance_from_center_m?: number;
  }>;
  keywords: Array<{ id: string; keyword: string }>;
  business: GridCellJob["business"];
  device: string;
  os: string;
  browser: string;
  organizationId?: string;
  /** When true, skip cells that already have complete saved results. */
  resume?: boolean;
  onSoftReady?: () => Promise<void>;
  onLeaseHeartbeat?: () => Promise<void>;
}): Promise<{ failedCells: number; totalCells: number; successCells: number }> {
  const depth = mapsDepth();
  const timeoutMs = mapsGridCellTimeoutMs();
  const maxRounds = mapsGridMaxRetryRounds();
  const retryDelayMs = mapsGridRetryDelayMs();
  const batchSize = mapsCellBatchSize();

  const allJobs = buildGridCellJobs(params);
  const totalCells = allJobs.length;

  let jobs = allJobs;
  let alreadyComplete = 0;

  if (params.resume && allJobs.length > 0) {
    const supabaseResume = createServiceClient();
    const pointIds = [...new Set(allJobs.map((j) => j.point.id))];
    const { data: savedResults } = await supabaseResume
      .from("scan_results")
      .select("scan_point_id, keyword_id, target_found, top_competitors_json")
      .in("scan_point_id", pointIds);

    const completeKeys = new Set(
      (savedResults ?? [])
        .filter((r) => validateStoredCellResult(r, depth).complete)
        .map((r) => `${r.scan_point_id}:${r.keyword_id}`)
    );
    jobs = allJobs.filter((j) => !completeKeys.has(`${j.point.id}:${j.keyword.id}`));
    alreadyComplete = allJobs.length - jobs.length;
    console.log("[Scan] Resume skip complete cells:", {
      scanBatchId: params.scanBatchId,
      totalCells,
      alreadyComplete,
      remaining: jobs.length,
    });
  }

  const primaryChunks = chunkJobs(jobs, batchSize);

  const supabase = createServiceClient();
  await supabase
    .from("scan_batches")
    .update({
      cells_total: totalCells,
      cells_completed: alreadyComplete,
      cells_failed: 0,
    })
    .eq("id", params.scanBatchId);

  console.log("[Scan] Live parallel grid (Bright Data):", {
    scanBatchId: params.scanBatchId,
    resume: !!params.resume,
    totalCells,
    pendingCells: jobs.length,
    alreadyComplete,
    batchSize,
    primaryBatches: primaryChunks.length,
    timeoutMs,
    maxRetryRounds: maxRounds - 1,
    retryDelayMs,
    depth,
    device: params.device,
    os: params.os,
    browser: params.browser,
    uniqueCoordinates: new Set(allJobs.map((j) => `${j.point.lat},${j.point.lng}`)).size,
  });

  const allTimings: CellPhaseTimings[] = [];
  const scanWallStart = performance.now();
  let rankReadyStarted = false;
  let rankReadyPromise: Promise<void> | null = null;
  const softMin = softReadyMinSuccess(totalCells);

  const onSoftReady = async () => {
    if (!params.onSoftReady) return;
    if (!rankReadyPromise) {
      rankReadyStarted = true;
      rankReadyPromise = params.onSoftReady();
    }
    await rankReadyPromise;
  };

  const onCellSettled = async (success: boolean) => {
    if (params.onLeaseHeartbeat) {
      await params.onLeaseHeartbeat().catch(() => undefined);
    }
    if (success) {
      await refreshScanAggregateMetrics(params.scanBatchId);
    }
  };

  // Already past soft-ready threshold from prior progress — promote immediately.
  if (alreadyComplete >= softMin && params.onSoftReady) {
    await onSoftReady();
  }

  if (jobs.length === 0) {
    const integrity = await runIntegrityPass({
      scanBatchId: params.scanBatchId,
      jobs: allJobs,
      depth,
      timeoutMs,
      maxAttempts: 1,
      concurrency: mapsGridConcurrency(totalCells),
      totalCells,
      organizationId: params.organizationId,
      onCellSettled,
    });
    const failedCells = integrity.failedCells;
    const successCells = Math.max(0, totalCells - failedCells);
    await scheduleCellProgress(
      params.scanBatchId,
      totalCells,
      totalCells,
      failedCells,
      { pass: "complete", method: "live_parallel_resume_noop", failed_point_ids: [] },
      { force: true }
    );
    if (!rankReadyPromise && params.onSoftReady) {
      await onSoftReady();
    }
    await refreshScanAggregateMetrics(params.scanBatchId);
    return { failedCells, totalCells, successCells };
  }

  let completedOffset = alreadyComplete;
  const failedFromPrimary: GridCellJob[] = [];

  for (let batchIndex = 0; batchIndex < primaryChunks.length; batchIndex++) {
    const chunk = primaryChunks[batchIndex];
    const passLabel =
      primaryChunks.length > 1 ? `primary-batch-${batchIndex + 1}` : "primary";
    console.log(
      `[Scan] Primary batch ${batchIndex + 1}/${primaryChunks.length}: ${chunk.length} cells`
    );
    const pass = await runJobsWithConcurrency(chunk, {
      scanBatchId: params.scanBatchId,
      depth,
      timeoutMs,
      maxAttempts: 1,
      concurrency: mapsGridConcurrency(chunk.length),
      totalCells,
      passLabel,
      completedOffset,
      updateProgress: true,
      softReadyMinSuccess: rankReadyStarted ? undefined : softMin,
      onSoftReady: rankReadyStarted ? undefined : onSoftReady,
      onCellSettled,
      organizationId: params.organizationId,
    });
    allTimings.push(...pass.timings);
    failedFromPrimary.push(...failedJobsFromPass(chunk, pass.results));
    // Advance by successes only — failed cells stay off the public counter until retry/finish.
    completedOffset += pass.successCount;
  }

  let remainingJobs = failedFromPrimary;
  let failedCells = remainingJobs.length;

  for (let round = 2; round <= maxRounds && remainingJobs.length > 0; round++) {
    if (retryDelayMs > 0) {
      await sleep(retryDelayMs);
    }
    const passLabel = `retry-${round - 1}`;
    console.log(
      `[Scan] Retry round ${round - 1}/${maxRounds - 1}: ${remainingJobs.length} failed cells`
    );
    // Offset = cells already successful; retries fill the gap instead of sitting at 100%.
    const retryOffset = completedOffset;
    const pass = await runJobsWithConcurrency(remainingJobs, {
      scanBatchId: params.scanBatchId,
      depth,
      timeoutMs,
      maxAttempts: 1,
      concurrency: mapsGridConcurrency(remainingJobs.length),
      totalCells,
      passLabel,
      completedOffset: retryOffset,
      updateProgress: true,
      onCellSettled,
      organizationId: params.organizationId,
    });
    allTimings.push(...pass.timings);
    completedOffset += pass.successCount;
    remainingJobs = failedJobsFromPass(remainingJobs, pass.results);
    failedCells = remainingJobs.length;
    if (remainingJobs.length > 0 && round < maxRounds) {
      console.log(`[Scan] ${remainingJobs.length} cells still failing after ${passLabel}`);
    }
  }

  const integrityConcurrency = mapsGridConcurrency(totalCells);
  const integrity = await runIntegrityPass({
    scanBatchId: params.scanBatchId,
    jobs: allJobs,
    depth,
    timeoutMs,
    maxAttempts: 1,
    concurrency: integrityConcurrency,
    totalCells,
    organizationId: params.organizationId,
    onCellSettled,
  });
  allTimings.push(...integrity.timings);
  const failedPointIds = [
    ...new Set([...remainingJobs.map((j) => j.point.id), ...integrity.failedPointIds]),
  ];
  failedCells = failedPointIds.length;

  const successCells = Math.max(0, totalCells - failedCells);
  await scheduleCellProgress(
    params.scanBatchId,
    totalCells,
    totalCells,
    failedCells,
    {
      pass: "complete",
      method: params.resume ? "live_parallel_resume" : "live_parallel",
      failed_point_ids: failedPointIds,
    },
    { force: true }
  );

  if (!rankReadyPromise && params.onSoftReady) {
    await onSoftReady();
  }
  await refreshScanAggregateMetrics(params.scanBatchId);

  const wallSec = elapsedSec(scanWallStart);
  console.log(`[ScanBenchmark] wall_clock=${wallSec}s`);
  logCellPhaseTimings(params.scanBatchId, allTimings, integrityConcurrency, totalCells);

  return { failedCells, totalCells, successCells };
}
