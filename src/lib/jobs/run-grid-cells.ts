import pLimit from "p-limit";
import { createServiceClient } from "@/lib/db/client";
import { extractTopCompetitors, type MapsLiveResult } from "@/lib/providers/dataforseo";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { matchTargetInResults } from "@/lib/providers/dataforseo/match-target";
import {
  elapsedSec,
  logCellPhaseTimings,
  type CellPhaseTimings,
} from "@/lib/jobs/scan-cell-benchmark";
import { saveCellTelemetry } from "@/lib/jobs/scan-cell-telemetry";
import { refreshScanAggregateMetrics } from "@/lib/jobs/refresh-scan-metrics";
import { mergeScanConfidenceSummary } from "@/lib/jobs/merge-confidence-summary";
import {
  validateLiveCellSerp,
  validateStoredCellResult,
} from "@/lib/maps/cell-result-integrity";
import { invalidateScanGridCache } from "@/lib/maps/scan-queries";
import { fairChunkSize } from "@/lib/queue/bright-data-limiter";
import { withDbLimit } from "@/lib/platform/db-limiter";
import {
  EARLY_ENRICHMENT_MIN_CELLS,
  maybeStartEarlyEnrichment,
} from "@/lib/jobs/run-early-enrichment";
import {
  brightDataNormalCellTimeoutMs,
  brightDataRecoveryDeadlineMs,
} from "@/lib/providers/maps-grid/config";
import {
  isolatedRetryConcurrency,
  isolatedRetryDelayMs,
  listBrightDataRecoveryRounds,
  recoveryRoundConcurrency,
  recoveryRoundDelayMs,
} from "@/lib/providers/maps-grid/batch-recovery";
import {
  brightDataOnlyProviders,
  fetchMapsCell,
  logMapsProviderAvailability,
  resolveUsableMapsProviders,
} from "@/lib/providers/maps-grid/orchestrator";
import type { MapsFailureCategory } from "@/lib/providers/maps-grid/failure-categories";
import type { MapsProviderId, MapsRecoveryStage } from "@/lib/providers/maps-grid/types";
import {
  DEFAULT_MAPS_PROVIDER_MODE,
  integrityProvidersForMode,
  mapsProviderModeLabel,
  parseMapsProviderMode,
  primaryProvidersForMode,
  type MapsProviderMode,
} from "@/lib/maps/provider-modes";

/** Default wave size — overridden by BRIGHTDATA_GRID_BATCH_SIZE / FAIR_CHUNK (max 100). */
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
      process.env.BRIGHTDATA_FAIR_CHUNK_SIZE ??
      process.env.BRIGHTDATA_BURST_MAX_CONCURRENCY ??
      ""
  );
  // Cap at 100 — matches Bright Data start capacity and fair-chunk default.
  if (Number.isFinite(n) && n > 0) return Math.min(Math.floor(n), 100);
  return Math.min(fairChunkSize() || BRIGHTDATA_GRID_BATCH_SIZE, 100);
}

/**
 * In-scan parallelism. Defaults to min(cells, 100) so a lone 7×7/10×10
 * fires in one wave. Extra simultaneous scans are paced by
 * acquireBrightDataSlot (global Redis rate + in-flight), not by this cap.
 */
export function mapsGridConcurrency(cellCount: number): number {
  return Math.min(Math.max(cellCount, 0), mapsCellBatchSize());
}

export function mapsGridCellTimeoutMs(): number {
  const n = Number(
    process.env.BRIGHTDATA_GRID_CELL_TIMEOUT_MS ??
      process.env.BRIGHTDATA_BURST_CELL_TIMEOUT_MS ??
      brightDataNormalCellTimeoutMs()
  );
  return Number.isFinite(n) && n > 0 ? n : brightDataNormalCellTimeoutMs();
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
  failureCategory?: MapsFailureCategory;
  finalProvider?: MapsProviderId | null;
  unresolved?: boolean;
};

async function saveCellProgress(
  scanBatchId: string,
  completed: number,
  total: number,
  failed: number,
  extra?: Record<string, unknown>
) {
  return withDbLimit(async () => {
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
      provider: (extra?.final_provider as string | undefined) ?? "brightdata",
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
  });
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

const PROGRESS_FLUSH_MS = Number(process.env.SCAN_PROGRESS_FLUSH_MS ?? 1000);
const PROGRESS_UNIT_STEP = Number(process.env.SCAN_PROGRESS_UNIT_STEP ?? 5);
const PROGRESS_PERCENT_STEP = Number(process.env.SCAN_PROGRESS_PERCENT_STEP ?? 5);

type ProgressThrottleState = {
  lastFlushAt: number;
  lastFlushedCompleted: number;
  lastFlushedPercent: number;
  pending: {
    completed: number;
    total: number;
    failed: number;
    extra?: Record<string, unknown>;
  } | null;
  flushTimer: ReturnType<typeof setTimeout> | null;
};

const progressThrottleByScan = new Map<string, ProgressThrottleState>();

function cellProgressPercent(completed: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((completed / total) * 100);
}

function shouldFlushCellProgress(
  state: ProgressThrottleState,
  pending: { completed: number; total: number },
  force: boolean
): boolean {
  if (force) return true;
  if (pending.total > 0 && pending.completed >= pending.total) return true;
  if (Date.now() - state.lastFlushAt >= PROGRESS_FLUSH_MS) return true;
  if (pending.completed - state.lastFlushedCompleted >= PROGRESS_UNIT_STEP) return true;
  const pct = cellProgressPercent(pending.completed, pending.total);
  if (pct - state.lastFlushedPercent >= PROGRESS_PERCENT_STEP) return true;
  return false;
}

async function flushPendingProgress(scanBatchId: string, force = false): Promise<void> {
  const state = progressThrottleByScan.get(scanBatchId);
  if (!state?.pending) return;
  if (!shouldFlushCellProgress(state, state.pending, force)) return;
  const payload = state.pending;
  state.pending = null;
  state.lastFlushAt = Date.now();
  state.lastFlushedCompleted = payload.completed;
  state.lastFlushedPercent = cellProgressPercent(payload.completed, payload.total);
  if (state.flushTimer) {
    clearTimeout(state.flushTimer);
    state.flushTimer = null;
  }
  await enqueueProgressWrite(scanBatchId, () =>
    saveCellProgress(scanBatchId, payload.completed, payload.total, payload.failed, payload.extra)
  );

  // Kick early enrichment once enough cells exist (queued; never blocks the scan).
  if (payload.completed >= EARLY_ENRICHMENT_MIN_CELLS) {
    void maybeStartEarlyEnrichment(scanBatchId).catch((err) => {
      console.warn("[Scan] early enrichment kick failed", scanBatchId, err);
    });
  }
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
    state = {
      lastFlushAt: 0,
      lastFlushedCompleted: 0,
      lastFlushedPercent: 0,
      pending: null,
      flushTimer: null,
    };
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
  if (shouldFlushCellProgress(state, state.pending, options?.force === true)) {
    await flushPendingProgress(scanBatchId, true);
    return;
  }
  if (!state.flushTimer) {
    const elapsed = Date.now() - state.lastFlushAt;
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
  _maxAttempts: number,
  passLabel: string,
  concurrency: number,
  providers: MapsProviderId[],
  options?: { allowTransientRetry?: boolean; scanRetryRound?: number }
): Promise<GridCellRunResult> {
  const supabase = createServiceClient();
  const kw = job.keyword.keyword.trim();
  const lat = job.point.lat;
  const lng = job.point.lng;
  const locationCoordinate = `${lat},${lng},${LOCAL_FALCON_PARITY.locationZoom}`;
  const cellStarted = performance.now();
  let matchingSec = 0;
  let dbSaveSec = 0;

  const device = job.device === "mobile" ? "mobile" : "desktop";
  const os = (
    ["android", "ios", "windows", "macos"].includes(job.os)
      ? job.os
      : job.device === "mobile"
        ? "android"
        : "windows"
  ) as "android" | "ios" | "windows" | "macos";
  const browser = job.browser === "firefox" ? "firefox" : "chrome";

  const targetInput = {
    cid: job.business.cid,
    place_id: job.business.place_id,
    name: job.business.name,
    address: job.business.address_text,
    phone: job.business.phone,
    website_url: job.business.website_url,
  };

  const apiStart = performance.now();
  const fetched = await fetchMapsCell({
    keyword: kw,
    lat,
    lng,
    device,
    os,
    browser,
    depth,
    organizationId: job.organizationId,
    providers,
    allowTransientRetry: options?.allowTransientRetry,
    target: targetInput,
    gridLabel: job.point.grid_label,
  });
  const apiSec = elapsedSec(apiStart);
  const attemptsUsed = Math.max(1, fetched.attempts.length);

  if (fetched.ok) {
    const items = fetched.items as MapsLiveResult[];
    // Orchestrator already required complete SERP when target was provided.
    const serpValidation = validateLiveCellSerp(items, targetInput, depth);
    if (!serpValidation.complete) {
      const category = (serpValidation.category ?? "sparse_maps_results") as MapsFailureCategory;
      const totalSec = elapsedSec(cellStarted);
      const timings: CellPhaseTimings = {
        gridLabel: job.point.grid_label,
        apiSec,
        matchingSec: 0,
        dbSaveSec: 0,
        progressSec: 0,
        totalSec,
        success: false,
        attempts: attemptsUsed,
        failureCategory: category,
      };
      void saveCellTelemetry({
        scanBatchId: job.scanBatchId,
        scanPointId: job.point.id,
        keywordId: job.keyword.id,
        gridLabel: job.point.grid_label,
        provider: fetched.finalProvider,
        concurrency,
        apiLatencyMs: apiSec * 1000,
        matchingMs: 0,
        dbSaveMs: 0,
        totalMs: totalSec * 1000,
        attempts: attemptsUsed,
        success: false,
        timedOut: false,
        errorMessage: serpValidation.reason,
        failureCategory: category,
        providerDiagnostics: {
          scanRetryRound: options?.scanRetryRound ?? 0,
          providerAttempt: attemptsUsed,
          attempts: fetched.attempts,
        },
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
        failureCategory: category,
        finalProvider: fetched.finalProvider,
        unresolved: true,
      };
    }

    const matchStart = performance.now();
    const match = matchTargetInResults(items, targetInput, items.length);
    matchingSec = elapsedSec(matchStart);

    if (parityDebug()) {
      console.log("[GridParity]", {
        gridLabel: job.point.grid_label,
        request: fetched.request,
        itemCount: items.length,
        targetRank: match.rank,
        matchReason: match.matchReason,
        finalProvider: fetched.finalProvider,
      });
    }

    const dbStart = performance.now();
    const resultPayload = {
      scan_point_id: job.point.id,
      keyword_id: job.keyword.id,
      target_rank: match.rank,
      target_found: match.found,
      check_url: null,
      source_timestamp: fetched.timestamp,
      confidence: match.matchReason,
      top_competitors_json: extractTopCompetitors(items),
      provider_request_json: {
        ...fetched.request,
        _cell_meta: {
          primary_provider: fetched.primaryProvider,
          final_provider: fetched.finalProvider,
          fallback_used: fetched.fallbackUsed,
          fallback_reason: fetched.fallbackReason,
          provider_latency_ms: fetched.providerLatencyMs,
          pass: passLabel,
          timeout_ms: timeoutMs,
        },
      } as Record<string, unknown>,
    };
    const { error: upsertError } = await supabase.from("scan_results").upsert(resultPayload, {
      onConflict: "scan_point_id,keyword_id",
      ignoreDuplicates: false,
    });
    if (upsertError) {
      console.error(`[Scan] Upsert failed grid=${job.point.grid_label}:`, upsertError.message);
      return {
        success: false,
        pointId: job.point.id,
        keywordId: job.keyword.id,
        gridLabel: job.point.grid_label,
        failureCategory: "permanent_error",
        finalProvider: fetched.finalProvider,
      };
    }
    dbSaveSec = elapsedSec(dbStart);
    invalidateScanGridCache(job.scanBatchId);

    if (job.organizationId) {
      const { recordUsage } = await import("@/lib/platform/usage-ledger");
      const { estimateProviderCost } = await import("@/lib/providers/fetch-with-timeout");
      // Record real cost for every paid attempt; customer map_credits stay at the scan reservation.
      for (const attempt of fetched.attempts) {
        const cost = estimateProviderCost(attempt.provider);
        await recordUsage({
          organizationId: job.organizationId,
          feature: "maps_grid_cell_attempt",
          provider: attempt.provider,
          unitType: "request",
          estimatedCostUsd: cost,
          actualCostUsd: cost,
          actualUnits: 1,
          idempotencyKey: `${attempt.provider}:maps_grid_cell:${job.scanBatchId}:${job.point.id}:${job.keyword.id}:a${attempt.attemptNumber}:${passLabel}`,
          metadata: {
            scan_batch_id: job.scanBatchId,
            scan_point_id: job.point.id,
            keyword_id: job.keyword.id,
            pass: passLabel,
            success: attempt.success,
            failure_category: attempt.category,
            fallback_reason: fetched.fallbackReason,
          },
        }).catch(() => {});
      }
    }

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
      provider: fetched.finalProvider,
      concurrency,
      apiLatencyMs: apiSec * 1000,
      matchingMs: matchingSec * 1000,
      dbSaveMs: dbSaveSec * 1000,
      totalMs: totalSec * 1000,
      attempts: attemptsUsed,
      success: true,
      timedOut: false,
      providerDiagnostics: {
        scanRetryRound: options?.scanRetryRound ?? 0,
        providerAttempt: attemptsUsed,
        final_provider: fetched.finalProvider,
        fallback_used: fetched.fallbackUsed,
      },
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
      finalProvider: fetched.finalProvider,
    };
  }

  const lastCategory = fetched.lastCategory;
  const timedOut =
    lastCategory === "provider_timeout" || lastCategory === "capacity_timeout";
  console.error(
    `[Scan] Cell unresolved grid=${job.point.grid_label} keyword="${kw}" coord=${locationCoordinate}` +
      ` category=${lastCategory} apiSec=${apiSec} providers=${providers.join("→")}:`,
    fetched.lastErrorMessage
  );

  const totalSec = elapsedSec(cellStarted);
  const timings: CellPhaseTimings = {
    gridLabel: job.point.grid_label,
    apiSec,
    matchingSec: 0,
    dbSaveSec: 0,
    progressSec: 0,
    totalSec,
    success: false,
    attempts: attemptsUsed,
    failureCategory: lastCategory,
  };

  void saveCellTelemetry({
    scanBatchId: job.scanBatchId,
    scanPointId: job.point.id,
    keywordId: job.keyword.id,
    gridLabel: job.point.grid_label,
    provider: fetched.finalProvider ?? providers[0] ?? "brightdata",
    concurrency,
    apiLatencyMs: apiSec * 1000,
    matchingMs: 0,
    dbSaveMs: 0,
    totalMs: totalSec * 1000,
    attempts: attemptsUsed,
    success: false,
    timedOut,
    errorMessage: fetched.lastErrorMessage,
    failureCategory: lastCategory,
    providerDiagnostics: {
      unresolved_reason: fetched.unresolvedReason,
      scanRetryRound: options?.scanRetryRound ?? 0,
      providerAttempt: attemptsUsed,
      attempts: fetched.attempts,
      fallback_reason: fetched.fallbackReason,
    },
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
    failureCategory: lastCategory,
    finalProvider: fetched.finalProvider,
    unresolved: true,
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
    providers?: MapsProviderId[];
    allowTransientRetry?: boolean;
    scanRetryRound?: number;
    recoveryStage?: MapsRecoveryStage;
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
  const providers = params.providers ?? brightDataOnlyProviders();
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
          params.concurrency,
          providers,
          {
            allowTransientRetry: params.allowTransientRetry,
            scanRetryRound: params.scanRetryRound,
          }
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
            {
              pass: params.passLabel,
              failed_point_ids: [...new Set(failedPointIds)],
              ...(params.recoveryStage ? { recovery_stage: params.recoveryStage } : {}),
              providers: providers.join(","),
            }
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
      {
        pass: params.passLabel,
        failed_point_ids: [...new Set(failedPointIds)],
        ...(params.recoveryStage ? { recovery_stage: params.recoveryStage } : {}),
        providers: providers.join(","),
      },
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

/** Jobs that did not succeed in this pass (includes missing results). */
function failedJobsFromPass(jobs: GridCellJob[], results: GridCellRunResult[]): GridCellJob[] {
  const succeeded = new Set(
    results.filter((r) => r.success).map((r) => `${r.pointId}:${r.keywordId}`)
  );
  return jobs.filter((job) => !succeeded.has(`${job.point.id}:${job.keyword.id}`));
}

function jobKey(job: Pick<GridCellJob, "point" | "keyword">): string {
  return `${job.point.id}:${job.keyword.id}`;
}

/** Union unresolved sets — never drop in-memory failures just because a DB read looked empty/stale. */
export function mergeUnresolvedJobs(a: GridCellJob[], b: GridCellJob[]): GridCellJob[] {
  const map = new Map<string, GridCellJob>();
  for (const job of a) map.set(jobKey(job), job);
  for (const job of b) map.set(jobKey(job), job);
  return [...map.values()];
}

/** Re-read incomplete cells from DB so fallback cannot be skipped due to in-memory drift. */
async function loadIncompleteJobsFromDb(
  scanBatchId: string,
  jobs: GridCellJob[],
  depth: number
): Promise<GridCellJob[]> {
  const supabase = createServiceClient();
  const pointIds = [...new Set(jobs.map((j) => j.point.id))];
  if (!pointIds.length) return [];

  // Chunk .in() filters — PostgREST URL limits can silently truncate large grids.
  const savedResults: Array<{
    scan_point_id: string;
    keyword_id: string;
    target_found: boolean;
    top_competitors_json: unknown;
  }> = [];
  const chunkSize = 100;
  for (let i = 0; i < pointIds.length; i += chunkSize) {
    const chunk = pointIds.slice(i, i + chunkSize);
    const { data, error } = await supabase
      .from("scan_results")
      .select("scan_point_id, keyword_id, target_found, top_competitors_json")
      .in("scan_point_id", chunk);
    if (error) {
      console.error(
        `[Scan] loadIncompleteJobsFromDb query failed scan=${scanBatchId}:`,
        error.message
      );
      // Fail open — treat all jobs as incomplete so secondary fallback still runs.
      return jobs;
    }
    if (data?.length) savedResults.push(...(data as typeof savedResults));
  }

  return jobs.filter((job) => {
    const row = savedResults.find(
      (r) => r.scan_point_id === job.point.id && r.keyword_id === job.keyword.id
    );
    return !validateStoredCellResult(row, depth).complete;
  });
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
  providerMode?: MapsProviderMode;
}): Promise<{
  failedCells: number;
  failedPointIds: string[];
  timings: CellPhaseTimings[];
  successCount: number;
}> {
  const providerMode = parseMapsProviderMode(params.providerMode);
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
    `[Scan] Integrity retry for ${incompleteJobs.length} sparse/incomplete cells (concurrency=${params.concurrency} mode=${providerMode})`
  );
  // Mode-aware integrity chain. Always pass the full list so each provider
  // records an attempt even when credentials are missing on this worker.
  const integrityProviders = integrityProvidersForMode(providerMode);
  const integrityPlan = await resolveUsableMapsProviders(integrityProviders);
  console.log(
    `[Scan] Integrity providers chain=${integrityProviders.join("→")} ready=${integrityPlan.usable.join(",") || "none"}` +
      (integrityPlan.skipped.length
        ? ` skipped=${integrityPlan.skipped.map((s) => `${s.provider}:${s.skipReason}`).join(",")}`
        : "")
  );

  const integrityPass = await runJobsWithConcurrency(incompleteJobs, {
    scanBatchId: params.scanBatchId,
    depth: params.depth,
    timeoutMs: params.timeoutMs,
    maxAttempts: params.maxAttempts,
    concurrency: Math.min(params.concurrency, isolatedRetryConcurrency(incompleteJobs.length) || params.concurrency),
    totalCells: params.totalCells,
    passLabel: "integrity",
    providers: integrityProviders,
    allowTransientRetry: true,
    scanRetryRound: 5,
    recoveryStage: "finalizing",
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
  /** Hybrid / ScrapingDog-only / DataForSEO-only — for A/B testing. */
  providerMode?: MapsProviderMode;
  onSoftReady?: () => Promise<void>;
  onLeaseHeartbeat?: () => Promise<void>;
}): Promise<{ failedCells: number; totalCells: number; successCells: number }> {
  const depth = mapsDepth();
  const timeoutMs = mapsGridCellTimeoutMs();
  const maxRounds = mapsGridMaxRetryRounds();
  const retryDelayMs = mapsGridRetryDelayMs();
  const batchSize = mapsCellBatchSize();
  const providerMode = parseMapsProviderMode(params.providerMode ?? DEFAULT_MAPS_PROVIDER_MODE);
  const primaryProviders = primaryProvidersForMode(providerMode);
  const useBrightDataRecovery = providerMode === "hybrid";

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

  console.log("[Scan] Live parallel grid:", {
    scanBatchId: params.scanBatchId,
    resume: !!params.resume,
    providerMode,
    providerModeLabel: mapsProviderModeLabel(providerMode),
    primaryProviders,
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
  logMapsProviderAvailability(`scan=${params.scanBatchId} mode=${providerMode}`);

  const allTimings: CellPhaseTimings[] = [];
  const scanWallStart = performance.now();
  let rankReadyPromise: Promise<void> | null = null;

  const onSoftReady = async () => {
    if (!params.onSoftReady) return;
    if (!rankReadyPromise) {
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

  // Never soft-ready / finalize before the full grid settles (BD + secondaries +
  // integrity). Wait UI holds; map reveals only after pass=complete.

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
      providerMode,
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
    const primaryStage: MapsRecoveryStage =
      providerMode === "scrapingdog"
        ? "fallback_scrapingdog"
        : providerMode === "dataforseo"
          ? "fallback_dataforseo"
          : "scanning_brightdata";
    // Burst primary — up to 100 cells in parallel (global semaphore may still pace).
    const pass = await runJobsWithConcurrency(chunk, {
      scanBatchId: params.scanBatchId,
      depth,
      timeoutMs,
      maxAttempts: 1,
      concurrency: mapsGridConcurrency(chunk.length),
      totalCells,
      passLabel,
      providers: primaryProviders,
      allowTransientRetry: providerMode !== "hybrid",
      scanRetryRound: 0,
      recoveryStage: primaryStage,
      completedOffset,
      updateProgress: true,
      // No mid-primary soft-ready — map waits until pass=complete after integrity.
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

  // ---- Recovery after primary ----
  // Hybrid: burst primary, then unfinished-only Bright Data waits:
  // 10s → 20s → 1m → 1m → 3m → 2m → 3m (no ScrapingDog mix).
  // Single-provider modes: one same-provider retry.
  if (remainingJobs.length > 0 && !useBrightDataRecovery) {
    console.log(
      `[Scan] ${providerMode} retry for ${remainingJobs.length} cells (same provider, no Bright Data)`
    );
    await sleep(isolatedRetryDelayMs());
    const stage: MapsRecoveryStage =
      providerMode === "scrapingdog" ? "fallback_scrapingdog" : "fallback_dataforseo";
    await scheduleCellProgress(
      params.scanBatchId,
      completedOffset,
      totalCells,
      remainingJobs.length,
      {
        pass: `${providerMode}-retry`,
        recovery_stage: stage,
        maps_provider_mode: providerMode,
      },
      { force: true }
    );
    const retryPass = await runJobsWithConcurrency(remainingJobs, {
      scanBatchId: params.scanBatchId,
      depth,
      timeoutMs,
      maxAttempts: 1,
      concurrency: Math.min(remainingJobs.length, mapsGridConcurrency(remainingJobs.length)),
      totalCells,
      passLabel: `${providerMode}-retry`,
      providers: primaryProviders,
      allowTransientRetry: true,
      scanRetryRound: 1,
      recoveryStage: stage,
      completedOffset,
      updateProgress: true,
      onCellSettled,
      organizationId: params.organizationId,
    });
    allTimings.push(...retryPass.timings);
    completedOffset += retryPass.successCount;
    remainingJobs = failedJobsFromPass(remainingJobs, retryPass.results);
    failedCells = remainingJobs.length;
  }

  // Union in-memory failures with a full-grid DB check before recovery.
  {
    const memoryUnresolved = remainingJobs;
    const dbIncomplete = await loadIncompleteJobsFromDb(params.scanBatchId, allJobs, depth);
    remainingJobs = mergeUnresolvedJobs(memoryUnresolved, dbIncomplete);
    failedCells = remainingJobs.length;
    if (memoryUnresolved.length !== dbIncomplete.length || dbIncomplete.length !== remainingJobs.length) {
      console.warn(
        `[Scan] Unresolved sync: in-memory=${memoryUnresolved.length} db_incomplete=${dbIncomplete.length} union=${remainingJobs.length}`
      );
    }
  }

  if (remainingJobs.length > 0 && useBrightDataRecovery) {
    const recoveryRounds = listBrightDataRecoveryRounds();
    const deadlineMs = brightDataRecoveryDeadlineMs();
    console.log(
      `[Scan] Bright Data recovery plan: ${remainingJobs.length} unfinished · ` +
        `10s→20s→1m→1m→3m→2m→3m · deadline=${Math.round(deadlineMs / 1000)}s · ` +
        `Bright Data only (no ScrapingDog)`
    );

    // Exact scheduled rounds only — unfinished cells each time.
    for (let roundIndex = 0; roundIndex < recoveryRounds.length; roundIndex++) {
      if (remainingJobs.length === 0) break;
      const elapsed = performance.now() - scanWallStart;
      if (elapsed >= deadlineMs) {
        console.warn(
          `[Scan] Bright Data recovery deadline reached (${Math.round(elapsed / 1000)}s) — ` +
            `${remainingJobs.length} cells still unresolved (no provider fallback)`
        );
        break;
      }

      const round = recoveryRounds[roundIndex];

      const delayMs = recoveryRoundDelayMs(round);
      const totalRoundsLabel = String(recoveryRounds.length);
      await scheduleCellProgress(
        params.scanBatchId,
        completedOffset,
        totalCells,
        remainingJobs.length,
        {
          pass: `bd-delayed-wait-${round.round}`,
          recovery_stage: "scanning_brightdata",
          maps_provider_mode: providerMode,
          delayed_retry_round: round.round,
          delayed_retry_rounds: recoveryRounds.length,
          delayed_retry_delay_ms: delayMs,
          delayed_retry_concurrency: round.concurrency,
          unresolved_after_brightdata: remainingJobs.length,
          secondary_fallback_attempted: false,
        },
        { force: true }
      );
      console.log(
        `[Scan] Bright Data recovery wait ${round.round}/${totalRoundsLabel}: ` +
          `sleeping ${delayMs}ms then retrying ${remainingJobs.length} @ concurrency≤${round.concurrency}`
      );
      await sleep(delayMs);

      if (performance.now() - scanWallStart >= deadlineMs) {
        console.warn("[Scan] Deadline hit during recovery wait — stopping Bright Data retries");
        break;
      }

      const roundConcurrency = recoveryRoundConcurrency(round, remainingJobs.length);
      await scheduleCellProgress(
        params.scanBatchId,
        completedOffset,
        totalCells,
        remainingJobs.length,
        {
          pass: `bd-delayed-retry-${round.round}`,
          recovery_stage: "scanning_brightdata",
          maps_provider_mode: providerMode,
          delayed_retry_round: round.round,
          delayed_retry_rounds: recoveryRounds.length,
          delayed_retry_concurrency: roundConcurrency,
        },
        { force: true }
      );
      console.log(
        `[Scan] Bright Data recovery retry ${round.round}/${totalRoundsLabel} START ` +
          `for ${remainingJobs.length} cells (concurrency=${roundConcurrency})`
      );
      const pass = await runJobsWithConcurrency(remainingJobs, {
        scanBatchId: params.scanBatchId,
        depth,
        timeoutMs,
        maxAttempts: 1,
        concurrency: roundConcurrency,
        totalCells,
        passLabel: `bd-delayed-retry-${round.round}`,
        providers: brightDataOnlyProviders(),
        allowTransientRetry: false,
        scanRetryRound: round.round,
        recoveryStage: "scanning_brightdata",
        completedOffset,
        updateProgress: true,
        onCellSettled,
        organizationId: params.organizationId,
      });
      allTimings.push(...pass.timings);
      completedOffset += pass.successCount;
      remainingJobs = failedJobsFromPass(remainingJobs, pass.results);
      failedCells = remainingJobs.length;
      console.log(
        `[Scan] Bright Data recovery retry ${round.round}/${totalRoundsLabel} FINISHED: ` +
          `recovered=${pass.successCount} still_unresolved=${remainingJobs.length}`
      );

      if (remainingJobs.length > 0) {
        const dbIncomplete = await loadIncompleteJobsFromDb(params.scanBatchId, allJobs, depth);
        remainingJobs = mergeUnresolvedJobs(remainingJobs, dbIncomplete);
        failedCells = remainingJobs.length;
      }
    }

    if (remainingJobs.length === 0) {
      console.log("[Scan] All cells recovered via Bright Data");
    } else {
      console.log(
        `[Scan] ${remainingJobs.length} cells still unresolved after Bright Data recovery — integrity next (Bright Data only)`
      );
    }
  } else if (remainingJobs.length === 0) {
    console.log(
      `[Scan] No incomplete cells after primary (${providerMode}) — recovery not needed`
    );
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
    providerMode,
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
      unresolved_point_ids: failedPointIds,
      recovery_stage: failedCells > 0 ? "completed_with_unresolved" : "completed",
      provider_unresolved: failedCells > 0,
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
