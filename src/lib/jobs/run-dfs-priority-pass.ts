/**
 * DataForSEO Priority / Live batch passes for Maps grids.
 *
 * Accepts full packs (20+) and soft packs (10–19). Sparse packs (0–9) are
 * returned with serpItems so recovery can build place_id consensus.
 */

import pLimit from "p-limit";
import { createServiceClient } from "@/lib/db/client";
import {
  extractTopCompetitors,
  mapsLiveAdvanced,
  type MapsLiveResult,
} from "@/lib/providers/dataforseo";
import {
  runMapsPriorityBatch,
  sanitizeMapsTaskTag,
} from "@/lib/providers/dataforseo/maps-priority-batch";
import { matchTargetInResults } from "@/lib/providers/dataforseo/match-target";
import { validateLiveCellSerp } from "@/lib/maps/cell-result-integrity";
import { decideSerpAccept } from "@/lib/maps/serp-consensus";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { invalidateScanGridCache } from "@/lib/maps/scan-queries";
import {
  elapsedSec,
  type CellPhaseTimings,
} from "@/lib/jobs/scan-cell-benchmark";
import { saveCellTelemetry } from "@/lib/jobs/scan-cell-telemetry";
import type { MapsFailureCategory } from "@/lib/providers/maps-grid/failure-categories";
import type {
  GridCellJob,
  GridCellRunResult,
} from "@/lib/jobs/run-grid-cells";

function cellTag(job: GridCellJob): string {
  return `${job.point.id}__${job.keyword.id}`;
}

function deviceProfile(job: GridCellJob) {
  const device = job.device === "mobile" ? "mobile" : "desktop";
  const os = (
    ["android", "ios", "windows", "macos"].includes(job.os)
      ? job.os
      : device === "mobile"
        ? "android"
        : "windows"
  ) as "android" | "ios" | "windows" | "macos";
  const browser = job.browser === "firefox" ? "firefox" : "chrome";
  return { device, os, browser } as const;
}

export async function persistDataForSeoCellSuccess(params: {
  job: GridCellJob;
  items: MapsLiveResult[];
  request: Record<string, unknown>;
  timestamp?: string;
  depth: number;
  passLabel: string;
  apiSec: number;
  scanRetryRound: number;
  /** Skip min-SERP validation — used after sparse consensus. */
  forceAccept?: boolean;
  unstable?: boolean;
  acceptReason?: string;
  method?: string;
}): Promise<GridCellRunResult> {
  const {
    job,
    items,
    request,
    timestamp,
    depth,
    passLabel,
    apiSec,
    scanRetryRound,
    forceAccept = false,
    unstable = false,
    acceptReason,
    method = "dfs_priority_batch",
  } = params;
  const supabase = createServiceClient();
  const cellStarted = performance.now();
  const targetInput = {
    cid: job.business.cid,
    place_id: job.business.place_id,
    name: job.business.name,
    address: job.business.address_text,
    phone: job.business.phone,
    website_url: job.business.website_url,
  };

  if (!forceAccept) {
    const serp = validateLiveCellSerp(items, targetInput, depth);
    if (!serp.complete) {
      const category = (serp.category ?? "sparse_maps_results") as MapsFailureCategory;
      const timings: CellPhaseTimings = {
        gridLabel: job.point.grid_label,
        apiSec,
        matchingSec: 0,
        dbSaveSec: 0,
        progressSec: 0,
        totalSec: elapsedSec(cellStarted),
        success: false,
        attempts: 1,
        failureCategory: category,
      };
      void saveCellTelemetry({
        scanBatchId: job.scanBatchId,
        scanPointId: job.point.id,
        keywordId: job.keyword.id,
        gridLabel: job.point.grid_label,
        provider: "dataforseo",
        concurrency: 0,
        apiLatencyMs: apiSec * 1000,
        matchingMs: 0,
        dbSaveMs: 0,
        totalMs: timings.totalSec * 1000,
        attempts: 1,
        success: false,
        timedOut: false,
        errorMessage: serp.reason,
        failureCategory: category,
        providerDiagnostics: { scanRetryRound, pass: passLabel, method },
        distanceFromCenterM: job.point.distance_from_center_m,
        lat: job.point.lat,
        lng: job.point.lng,
        passLabel,
      });
      return {
        success: false,
        pointId: job.point.id,
        keywordId: job.keyword.id,
        gridLabel: job.point.grid_label,
        timings,
        failureCategory: category,
        finalProvider: "dataforseo",
        unresolved: true,
        serpItems: items,
      };
    }
  }

  const matchStart = performance.now();
  const match = matchTargetInResults(items, targetInput, items.length);
  const matchingSec = elapsedSec(matchStart);

  const dbStart = performance.now();
  const resultPayload = {
    scan_point_id: job.point.id,
    keyword_id: job.keyword.id,
    target_rank: match.rank,
    target_found: match.found,
    check_url: null,
    source_timestamp: timestamp ?? new Date().toISOString(),
    confidence: match.matchReason,
    top_competitors_json: extractTopCompetitors(items),
    provider_request_json: {
      ...request,
      _cell_meta: {
        primary_provider: "dataforseo",
        final_provider: "dataforseo",
        fallback_used: false,
        fallback_reason: null,
        pass: passLabel,
        method,
        unstable,
        accept_reason: acceptReason ?? (forceAccept ? "consensus_sparse" : "pack_ok"),
        item_count: items.length,
      },
    } as Record<string, unknown>,
  };

  const { error: upsertError } = await supabase.from("scan_results").upsert(resultPayload, {
    onConflict: "scan_point_id,keyword_id",
    ignoreDuplicates: false,
  });
  if (upsertError) {
    console.error(
      `[Scan] DataForSEO upsert failed grid=${job.point.grid_label}:`,
      upsertError.message
    );
    return {
      success: false,
      pointId: job.point.id,
      keywordId: job.keyword.id,
      gridLabel: job.point.grid_label,
      failureCategory: "permanent_error",
      finalProvider: "dataforseo",
      serpItems: items,
    };
  }

  const dbSaveSec = elapsedSec(dbStart);
  invalidateScanGridCache(job.scanBatchId);
  try {
    const { markCellComplete } = await import("@/lib/jobs/scan-cell-state");
    await markCellComplete(job.point.id);
  } catch {
    /* optional */
  }

  if (job.organizationId) {
    try {
      const { recordUsage } = await import("@/lib/platform/usage-ledger");
      const { estimateProviderCost } = await import("@/lib/providers/fetch-with-timeout");
      const cost = estimateProviderCost("dataforseo");
      await recordUsage({
        organizationId: job.organizationId,
        feature: "maps_grid_cell_attempt",
        provider: "dataforseo",
        unitType: "request",
        estimatedCostUsd: cost,
        actualCostUsd: cost,
        actualUnits: 1,
        idempotencyKey: `dataforseo:maps_grid_cell:${job.scanBatchId}:${job.point.id}:${job.keyword.id}:${method}:${passLabel}`,
        metadata: {
          scan_batch_id: job.scanBatchId,
          scan_point_id: job.point.id,
          keyword_id: job.keyword.id,
          pass: passLabel,
          success: true,
          method,
        },
      }).catch(() => {});
    } catch {
      /* non-blocking */
    }
  }

  const timings: CellPhaseTimings = {
    gridLabel: job.point.grid_label,
    apiSec,
    matchingSec,
    dbSaveSec,
    progressSec: 0,
    totalSec: elapsedSec(cellStarted),
    success: true,
    attempts: 1,
  };

  void saveCellTelemetry({
    scanBatchId: job.scanBatchId,
    scanPointId: job.point.id,
    keywordId: job.keyword.id,
    gridLabel: job.point.grid_label,
    provider: "dataforseo",
    concurrency: 0,
    apiLatencyMs: apiSec * 1000,
    matchingMs: matchingSec * 1000,
    dbSaveMs: dbSaveSec * 1000,
    totalMs: timings.totalSec * 1000,
    attempts: 1,
    success: true,
    timedOut: false,
    providerDiagnostics: {
      scanRetryRound,
      pass: passLabel,
      method,
      item_count: items.length,
      unstable,
      accept_reason: acceptReason,
    },
    distanceFromCenterM: job.point.distance_from_center_m,
    lat: job.point.lat,
    lng: job.point.lng,
    passLabel,
  });

  return {
    success: true,
    pointId: job.point.id,
    keywordId: job.keyword.id,
    gridLabel: job.point.grid_label,
    timings,
    finalProvider: "dataforseo",
    serpItems: items,
    acceptReason: acceptReason ?? (forceAccept ? "consensus_sparse" : "pack_ok"),
  };
}

function incompleteResult(params: {
  job: GridCellJob;
  items: MapsLiveResult[];
  apiSec: number;
  reason: string;
  category: MapsFailureCategory;
  passLabel: string;
  scanRetryRound: number;
  method: string;
  taskId?: string | null;
  taskStatus?: number | null;
}): GridCellRunResult {
  const { job, items, apiSec, reason, category, passLabel, scanRetryRound, method } = params;
  console.warn(
    `[Scan] DataForSEO incomplete grid=${job.point.grid_label} items=${items.length}: ${reason}`
  );
  void saveCellTelemetry({
    scanBatchId: job.scanBatchId,
    scanPointId: job.point.id,
    keywordId: job.keyword.id,
    gridLabel: job.point.grid_label,
    provider: "dataforseo",
    concurrency: 0,
    apiLatencyMs: apiSec * 1000,
    matchingMs: 0,
    dbSaveMs: 0,
    totalMs: apiSec * 1000,
    attempts: 1,
    success: false,
    timedOut: false,
    errorMessage: reason,
    failureCategory: category,
    providerDiagnostics: {
      scanRetryRound,
      pass: passLabel,
      method,
      task_id: params.taskId,
      item_count: items.length,
      task_status: params.taskStatus,
    },
    distanceFromCenterM: job.point.distance_from_center_m,
    lat: job.point.lat,
    lng: job.point.lng,
    passLabel,
  });
  return {
    success: false,
    pointId: job.point.id,
    keywordId: job.keyword.id,
    gridLabel: job.point.grid_label,
    failureCategory: category,
    finalProvider: "dataforseo",
    unresolved: true,
    serpItems: items,
    timings: {
      gridLabel: job.point.grid_label,
      apiSec,
      matchingSec: 0,
      dbSaveSec: 0,
      progressSec: 0,
      totalSec: apiSec,
      success: false,
      attempts: 1,
      failureCategory: category,
    },
  };
}

async function settleFetchedCell(params: {
  job: GridCellJob;
  items: MapsLiveResult[];
  request: Record<string, unknown>;
  timestamp?: string;
  depth: number;
  passLabel: string;
  apiSec: number;
  scanRetryRound: number;
  method: string;
  taskId?: string | null;
  taskStatus?: number | null;
  errorMessage?: string;
}): Promise<GridCellRunResult> {
  const decision = decideSerpAccept(params.items);
  if (decision.action === "accept") {
    return persistDataForSeoCellSuccess({
      job: params.job,
      items: params.items,
      request: params.request,
      timestamp: params.timestamp,
      depth: params.depth,
      passLabel: params.passLabel,
      apiSec: params.apiSec,
      scanRetryRound: params.scanRetryRound,
      acceptReason: decision.reason,
      method: params.method,
    });
  }

  const category: MapsFailureCategory =
    params.items.length === 0 ? "valid_empty_maps_results" : "sparse_maps_results";
  const reason =
    params.errorMessage ??
    (decision.reason === "empty"
      ? "DataForSEO returned no map results for this cell"
      : decision.reason === "target_only"
        ? "target-only SERP: only 1 listing returned"
        : `sparse SERP: ${params.items.length} results (awaiting consensus)`);

  return incompleteResult({
    job: params.job,
    items: params.items,
    apiSec: params.apiSec,
    reason,
    category,
    passLabel: params.passLabel,
    scanRetryRound: params.scanRetryRound,
    method: params.method,
    taskId: params.taskId,
    taskStatus: params.taskStatus,
  });
}

export async function runDataForSeoPriorityPass(params: {
  jobs: GridCellJob[];
  depth: number;
  passLabel: string;
  scanRetryRound?: number;
  organizationId?: string;
  forceDesktop?: boolean;
  locationZoom?: number;
  /** DataForSEO task_post priority: 1=standard, 2=high (default). */
  dfsApiPriority?: 1 | 2;
  submitPriority?: 1 | 2 | 3 | 4 | "highest" | "normal" | "lower" | "retry";
}): Promise<{
  results: GridCellRunResult[];
  successCount: number;
  timings: CellPhaseTimings[];
}> {
  const { jobs, depth, passLabel } = params;
  const scanRetryRound = params.scanRetryRound ?? 0;
  const locationZoom = params.locationZoom ?? LOCAL_FALCON_PARITY.locationZoom;
  const dfsApiPriority = params.dfsApiPriority === 1 ? 1 : 2;
  if (!jobs.length) {
    return { results: [], successCount: 0, timings: [] };
  }

  const scanKey = jobs[0]?.scanBatchId ?? `pass-${passLabel}`;
  const submitPriority =
    params.submitPriority ??
    (passLabel.includes("retry") ||
    passLabel.includes("integrity") ||
    passLabel.includes("recovery")
      ? 4
      : passLabel.includes("scheduled")
        ? 3
        : 1);

  const apiStart = performance.now();
  const batch = await runMapsPriorityBatch(
    jobs.map((job) => {
      const profile = deviceProfile(job);
      const device = params.forceDesktop ? "desktop" : profile.device;
      const os = params.forceDesktop ? "windows" : profile.os;
      return {
        tag: cellTag(job),
        keyword: job.keyword.keyword.trim(),
        lat: job.point.lat,
        lng: job.point.lng,
        device,
        os,
        browser: profile.browser,
        depth,
        languageCode: LOCAL_FALCON_PARITY.languageCode,
        zoom: locationZoom,
        searchThisArea: LOCAL_FALCON_PARITY.searchThisArea,
        dfsApiPriority,
      };
    }),
    params.organizationId ?? jobs[0]?.organizationId,
    {
      scanKey: `${scanKey}:${passLabel}`,
      submitPriority,
    }
  );
  const apiSec = elapsedSec(apiStart);
  const byTag = new Map(batch.map((r) => [r.tag, r] as const));

  const results: GridCellRunResult[] = [];
  for (const job of jobs) {
    const tag = sanitizeMapsTaskTag(cellTag(job));
    const row = byTag.get(tag);

    if (!row) {
      results.push({
        success: false,
        pointId: job.point.id,
        keywordId: job.keyword.id,
        gridLabel: job.point.grid_label,
        failureCategory: "provider_unavailable",
        finalProvider: "dataforseo",
        unresolved: true,
        serpItems: [],
        timings: {
          gridLabel: job.point.grid_label,
          apiSec,
          matchingSec: 0,
          dbSaveSec: 0,
          progressSec: 0,
          totalSec: apiSec,
          success: false,
          attempts: 1,
          failureCategory: "provider_unavailable",
        },
      });
      continue;
    }

    results.push(
      await settleFetchedCell({
        job,
        items: row.items,
        request: row.request as unknown as Record<string, unknown>,
        timestamp: row.timestamp,
        depth,
        passLabel,
        apiSec,
        scanRetryRound,
        method: "dfs_priority_batch",
        taskId: row.taskId,
        taskStatus: row.taskStatus,
        errorMessage: row.errorMessage,
      })
    );
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(
    `[Scan] Priority pass ${passLabel}: ${successCount}/${jobs.length} complete (20+ or 10–19 soft)`
  );

  return {
    results,
    successCount,
    timings: results.map((r) => r.timings).filter(Boolean) as CellPhaseTimings[],
  };
}

/**
 * Live advanced path for the last few unfinished cells (faster than Priority
 * when the unfinished set is tiny).
 */
export async function runDataForSeoLivePass(params: {
  jobs: GridCellJob[];
  depth: number;
  passLabel: string;
  scanRetryRound?: number;
  organizationId?: string;
  forceDesktop?: boolean;
  locationZoom?: number;
  concurrency?: number;
}): Promise<{
  results: GridCellRunResult[];
  successCount: number;
  timings: CellPhaseTimings[];
}> {
  const { jobs, depth, passLabel } = params;
  const scanRetryRound = params.scanRetryRound ?? 0;
  const locationZoom = params.locationZoom ?? LOCAL_FALCON_PARITY.locationZoom;
  if (!jobs.length) {
    return { results: [], successCount: 0, timings: [] };
  }

  const requested = params.concurrency ?? Math.min(5, jobs.length);
  const concurrency = Math.max(1, Math.min(requested, 25));
  const limit = pLimit(concurrency);
  console.log(
    `[Scan] DataForSEO Live pass ${passLabel}: ${jobs.length} cells (concurrency=${concurrency})`
  );

  const results = await Promise.all(
    jobs.map((job) =>
      limit(async () => {
        const profile = deviceProfile(job);
        const device = params.forceDesktop ? "desktop" : profile.device;
        const os = params.forceDesktop ? "windows" : profile.os;
        const apiStart = performance.now();
        try {
          const live = await mapsLiveAdvanced({
            keyword: job.keyword.keyword.trim(),
            lat: job.point.lat,
            lng: job.point.lng,
            device,
            os,
            browser: profile.browser,
            depth,
            languageCode: LOCAL_FALCON_PARITY.languageCode,
            zoom: locationZoom,
            searchThisArea: LOCAL_FALCON_PARITY.searchThisArea,
            searchPlaces: LOCAL_FALCON_PARITY.searchPlaces,
            seDomain: LOCAL_FALCON_PARITY.seDomain,
            organizationId: params.organizationId ?? job.organizationId,
          });
          const apiSec = elapsedSec(apiStart);
          return settleFetchedCell({
            job,
            items: live.items,
            request: live.request as unknown as Record<string, unknown>,
            timestamp: live.timestamp,
            depth,
            passLabel,
            apiSec,
            scanRetryRound,
            method: "dfs_live_advanced",
          });
        } catch (err) {
          const apiSec = elapsedSec(apiStart);
          const message = err instanceof Error ? err.message : String(err);
          return incompleteResult({
            job,
            items: [],
            apiSec,
            reason: message,
            category: "provider_unavailable",
            passLabel,
            scanRetryRound,
            method: "dfs_live_advanced",
          });
        }
      })
    )
  );

  const successCount = results.filter((r) => r.success).length;
  console.log(`[Scan] Live pass ${passLabel}: ${successCount}/${jobs.length} complete`);

  return {
    results,
    successCount,
    timings: results.map((r) => r.timings).filter(Boolean) as CellPhaseTimings[],
  };
}
