import pLimit from "p-limit";
import { createServiceClient } from "@/lib/db/client";
import { extractTopCompetitors, type MapsLiveResult } from "@/lib/providers/dataforseo";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { matchTargetInResults } from "@/lib/providers/dataforseo/match-target";
import { mapsGridCell } from "@/lib/providers/brightdata";
import {
  elapsedSec,
  logCellPhaseTimings,
  mapsConcurrencyForCellCount,
  softReadyMinSuccess,
  type CellPhaseTimings,
} from "@/lib/jobs/scan-cell-benchmark";
import { saveCellTelemetry } from "@/lib/jobs/scan-cell-telemetry";
import { refreshScanAggregateMetrics } from "@/lib/jobs/refresh-scan-metrics";
import { maybeStartEarlyEnrichment } from "@/lib/jobs/run-early-enrichment";

/** Bright Data SERP API: unlimited in-flight concurrency; keep a modest worker pool in-app. */
const BRIGHTDATA_DEFAULT_CONCURRENCY = 10;
const BRIGHTDATA_MAX_CONCURRENCY = 15;

export function mapsConcurrency(totalCells?: number): number {
  if (process.env.GRID_MAPS_SEQUENTIAL === "true") return 1;
  if (totalCells != null && totalCells > 0) {
    return Math.min(mapsConcurrencyForCellCount(totalCells), BRIGHTDATA_MAX_CONCURRENCY);
  }
  const n = Number(
    process.env.BRIGHTDATA_MAPS_CONCURRENCY ??
      process.env.SCRAPINGDOG_MAPS_CONCURRENCY ??
      BRIGHTDATA_DEFAULT_CONCURRENCY
  );
  return Number.isFinite(n) && n > 0 ? Math.min(n, BRIGHTDATA_MAX_CONCURRENCY) : BRIGHTDATA_DEFAULT_CONCURRENCY;
}

export function mapsCellMaxAttempts(): number {
  const n = Number(process.env.BRIGHTDATA_MAPS_CELL_MAX_ATTEMPTS ?? 4);
  return Number.isFinite(n) && n > 0 ? Math.min(n, 8) : 4;
}

export function mapsSoftTimeoutMs(): number {
  const n = Number(process.env.BRIGHTDATA_MAPS_SOFT_TIMEOUT_MS ?? 25000);
  return Number.isFinite(n) && n > 0 ? n : 25000;
}

export function mapsDepth(): number {
  const n = Number(
    process.env.BRIGHTDATA_MAPS_DEPTH ??
      process.env.SCRAPINGDOG_MAPS_DEPTH ??
      LOCAL_FALCON_PARITY.gridDepth
  );
  return Number.isFinite(n) && n > 0 ? Math.min(n, 100) : LOCAL_FALCON_PARITY.gridDepth;
}

export function mapsCellTimeoutMs(): number {
  const n = Number(
    process.env.BRIGHTDATA_MAPS_CELL_TIMEOUT_MS ??
      process.env.SCRAPINGDOG_MAPS_CELL_TIMEOUT_MS ??
      90000
  );
  return Number.isFinite(n) && n > 0 ? n : 90000;
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
  const { data: existing } = await supabase
    .from("scan_batches")
    .select("confidence_summary")
    .eq("id", scanBatchId)
    .single();
  const prev = (existing?.confidence_summary ?? {}) as Record<string, unknown>;
  const failedPointIds = Array.isArray(extra?.failed_point_ids)
    ? (extra.failed_point_ids as string[])
    : Array.isArray(prev.failed_point_ids)
      ? (prev.failed_point_ids as string[])
      : [];

  await supabase
    .from("scan_batches")
    .update({
      cells_total: total,
      cells_completed: completed,
      cells_failed: failed,
      confidence_summary: {
        ...prev,
        provider: "brightdata",
        method: "live_parallel",
        completed_cells: completed,
        total_cells: total,
        failed_cells: failed,
        failed_point_ids: failedPointIds,
        ...extra,
      },
    })
    .eq("id", scanBatchId);
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
      if (!items.length) {
        throw new Error("Bright Data returned no map results for this cell");
      }

      const matchStart = performance.now();
      const match = matchTargetInResults(
        items,
        {
          cid: job.business.cid,
          place_id: job.business.place_id,
          name: job.business.name,
          address: job.business.address_text,
          phone: job.business.phone,
          website_url: job.business.website_url,
        },
        items.length
      );
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
      await supabase.from("scan_results").insert({
        scan_point_id: job.point.id,
        keyword_id: job.keyword.id,
        target_rank: match.rank,
        target_found: match.found,
        check_url: null,
        source_timestamp: live.timestamp,
        confidence: match.matchReason,
        top_competitors_json: extractTopCompetitors(items),
        provider_request_json: live.request as unknown as Record<string, unknown>,
      });
      dbSaveSec = elapsedSec(dbStart);

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
): Promise<{ results: GridCellRunResult[]; failedCells: number; timings: CellPhaseTimings[] }> {
  const limit = pLimit(params.concurrency);
  const completedOffset = params.completedOffset ?? 0;
  const updateProgress = params.updateProgress !== false;
  let completed = 0;
  let successCount = 0;
  let failedCells = 0;
  let softReadyFired = false;
  const failedPointIds: string[] = [];
  const timings: CellPhaseTimings[] = [];

  const maybeSoftReady = async () => {
    if (softReadyFired || !params.onSoftReady || !params.softReadyMinSuccess) return;
    const maxTrailing = params.totalCells - params.softReadyMinSuccess;
    const remaining = params.totalCells - completed;
    if (remaining <= maxTrailing && completed >= params.softReadyMinSuccess) {
      softReadyFired = true;
      console.log(
        `[Scan] Soft rank_ready: ${completed}/${params.totalCells} cells done, ${successCount} succeeded, ${remaining} still in flight`
      );
      await params.onSoftReady();
    }
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
        if (result.success) successCount++;
        else {
          failedCells++;
          failedPointIds.push(job.point.id);
        }

        const progressStart = performance.now();
        if (updateProgress) {
          await saveCellProgress(
            params.scanBatchId,
            Math.min(completedOffset + completed, params.totalCells),
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
        if (updateProgress && successCount > 0) {
          void maybeStartEarlyEnrichment(params.scanBatchId, params.organizationId);
        }
        await params.onCellSettled?.(result.success);

        return result;
      })
    )
  );

  return { results, failedCells, timings };
}

function sortJobsCenterFirst(jobs: GridCellJob[]): GridCellJob[] {
  return [...jobs].sort(
    (a, b) =>
      (a.point.distance_from_center_m ?? Number.MAX_SAFE_INTEGER) -
      (b.point.distance_from_center_m ?? Number.MAX_SAFE_INTEGER)
  );
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
  onSoftReady?: () => Promise<void>;
}): Promise<{ failedCells: number; totalCells: number; successCells: number }> {
  const depth = mapsDepth();
  const softTimeoutMs = mapsSoftTimeoutMs();
  const backgroundTimeoutMs = mapsCellTimeoutMs();
  const backgroundMaxAttempts = mapsCellMaxAttempts();

  let jobs: GridCellJob[] = [];
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

  jobs = sortJobsCenterFirst(jobs);

  const totalCells = jobs.length;
  const concurrency = mapsConcurrency(totalCells);
  const softMin = softReadyMinSuccess(totalCells);

  const supabase = createServiceClient();
  await supabase
    .from("scan_batches")
    .update({ cells_total: totalCells, cells_completed: 0, cells_failed: 0 })
    .eq("id", params.scanBatchId);

  console.log("[Scan] Live parallel grid (Bright Data):", {
    scanBatchId: params.scanBatchId,
    totalCells,
    concurrency,
    softReadyMinSuccess: softMin,
    softTimeoutMs,
    backgroundTimeoutMs,
    backgroundMaxAttempts,
    depth,
    device: params.device,
    os: params.os,
    browser: params.browser,
    uniqueCoordinates: new Set(jobs.map((j) => `${j.point.lat},${j.point.lng}`)).size,
  });

  const allTimings: CellPhaseTimings[] = [];
  const scanWallStart = performance.now();
  let rankReadyFired = false;

  const onSoftReady = async () => {
    if (rankReadyFired || !params.onSoftReady) return;
    rankReadyFired = true;
    await params.onSoftReady();
  };

  const onCellSettled = async (success: boolean) => {
    if (success && rankReadyFired) {
      await refreshScanAggregateMetrics(params.scanBatchId);
    }
  };

  // Primary pass: fast timeout (25s), single attempt — don't let slow cells block the map
  const firstPass = await runJobsWithConcurrency(jobs, {
    scanBatchId: params.scanBatchId,
    depth,
    timeoutMs: softTimeoutMs,
    maxAttempts: 1,
    concurrency,
    totalCells,
    passLabel: "primary",
    softReadyMinSuccess: softMin,
    onSoftReady,
    onCellSettled,
    organizationId: params.organizationId,
  });
  allTimings.push(...firstPass.timings);

  const failedJobs = jobs.filter((job) =>
    firstPass.results.some((r) => !r.success && r.pointId === job.point.id && r.keywordId === job.keyword.id)
  );

  let failedCells = firstPass.failedCells;
  let successCells = totalCells - failedCells;

  if (failedJobs.length > 0) {
    console.log(
      `[Scan] Background retry for ${failedJobs.length} cells (concurrency=3, timeout=${backgroundTimeoutMs}ms)`
    );
    const retryPass = await runJobsWithConcurrency(failedJobs, {
      scanBatchId: params.scanBatchId,
      depth,
      timeoutMs: backgroundTimeoutMs,
      maxAttempts: backgroundMaxAttempts,
      concurrency: 3,
      totalCells,
      passLabel: "background",
      updateProgress: false,
      onCellSettled,
      organizationId: params.organizationId,
    });
    allTimings.push(...retryPass.timings);

    const recovered = failedJobs.length - retryPass.failedCells;
    failedCells = firstPass.failedCells - recovered;
    successCells = totalCells - failedCells;

    const stillFailedIds = failedJobs
      .filter((job) =>
        retryPass.results.some(
          (r) => !r.success && r.pointId === job.point.id && r.keywordId === job.keyword.id
        )
      )
      .map((j) => j.point.id);

    await saveCellProgress(params.scanBatchId, totalCells, totalCells, failedCells, {
      pass: "background",
      failed_point_ids: stillFailedIds,
    });
    console.log(`[Scan] Background retry recovered ${recovered}/${failedJobs.length} cells`);
  }

  if (!rankReadyFired && params.onSoftReady) {
    await onSoftReady();
  }

  if (rankReadyFired) {
    await refreshScanAggregateMetrics(params.scanBatchId);
  }

  const wallSec = elapsedSec(scanWallStart);
  console.log(`[ScanBenchmark] wall_clock=${wallSec}s (cells phase only)`);
  logCellPhaseTimings(params.scanBatchId, allTimings, concurrency);

  return {
    failedCells,
    totalCells,
    successCells,
  };
}
