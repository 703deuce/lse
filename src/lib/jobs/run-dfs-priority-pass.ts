/**
 * DataForSEO Priority batch pass for Maps grids.
 *
 * Submits all cells in one (or few) task_post calls, polls until ready,
 * then persists only packs with >= depth items.
 */

import { createServiceClient } from "@/lib/db/client";
import {
  extractTopCompetitors,
  type MapsLiveResult,
} from "@/lib/providers/dataforseo";
import {
  runMapsPriorityBatch,
  sanitizeMapsTaskTag,
} from "@/lib/providers/dataforseo/maps-priority-batch";
import { matchTargetInResults } from "@/lib/providers/dataforseo/match-target";
import { validateLiveCellSerp } from "@/lib/maps/cell-result-integrity";
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

// Types-only import from run-grid-cells (runtime import is the reverse direction).

function cellTag(job: GridCellJob): string {
  // Avoid ":" — DataForSEO tags are sanitized; keep a stable reversible key.
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

async function persistPrioritySuccess(params: {
  job: GridCellJob;
  items: MapsLiveResult[];
  request: Record<string, unknown>;
  timestamp?: string;
  depth: number;
  passLabel: string;
  apiSec: number;
  scanRetryRound: number;
}): Promise<GridCellRunResult> {
  const { job, items, request, timestamp, depth, passLabel, apiSec, scanRetryRound } =
    params;
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
      providerDiagnostics: { scanRetryRound, pass: passLabel, method: "dfs_priority_batch" },
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
    };
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
        method: "dfs_priority_batch",
      },
    } as Record<string, unknown>,
  };

  const { error: upsertError } = await supabase.from("scan_results").upsert(resultPayload, {
    onConflict: "scan_point_id,keyword_id",
    ignoreDuplicates: false,
  });
  if (upsertError) {
    console.error(
      `[Scan] Priority upsert failed grid=${job.point.grid_label}:`,
      upsertError.message
    );
    return {
      success: false,
      pointId: job.point.id,
      keywordId: job.keyword.id,
      gridLabel: job.point.grid_label,
      failureCategory: "permanent_error",
      finalProvider: "dataforseo",
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
        idempotencyKey: `dataforseo:maps_grid_cell:${job.scanBatchId}:${job.point.id}:${job.keyword.id}:priority:${passLabel}`,
        metadata: {
          scan_batch_id: job.scanBatchId,
          scan_point_id: job.point.id,
          keyword_id: job.keyword.id,
          pass: passLabel,
          success: true,
          method: "dfs_priority_batch",
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
      method: "dfs_priority_batch",
      item_count: items.length,
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
  };
}

export async function runDataForSeoPriorityPass(params: {
  jobs: GridCellJob[];
  depth: number;
  passLabel: string;
  scanRetryRound?: number;
  organizationId?: string;
  /**
   * Sparse mobile packs are common on edge pins. Retry passes can force
   * desktop + windows while keeping search_this_area=true.
   */
  forceDesktop?: boolean;
}): Promise<{
  results: GridCellRunResult[];
  successCount: number;
  timings: CellPhaseTimings[];
}> {
  const { jobs, depth, passLabel } = params;
  const scanRetryRound = params.scanRetryRound ?? 0;
  if (!jobs.length) {
    return { results: [], successCount: 0, timings: [] };
  }

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
        zoom: LOCAL_FALCON_PARITY.locationZoom,
        // Always STA for grid rank tracking (DataForSEO Maps requirement).
        searchThisArea: true,
      };
    }),
    params.organizationId ?? jobs[0]?.organizationId
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

    if (!row.ok || row.items.length < depth) {
      const category: MapsFailureCategory =
        row.items.length === 0 ? "valid_empty_maps_results" : "sparse_maps_results";
      const reason =
        row.errorMessage ??
        (row.items.length === 0
          ? "DataForSEO Priority returned no map results for this cell"
          : `sparse SERP: ${row.items.length} results returned (need ${depth})`);
      console.warn(
        `[Scan] Priority incomplete grid=${job.point.grid_label} items=${row.items.length} need=${depth}: ${reason}`
      );
      results.push({
        success: false,
        pointId: job.point.id,
        keywordId: job.keyword.id,
        gridLabel: job.point.grid_label,
        failureCategory: category,
        finalProvider: "dataforseo",
        unresolved: true,
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
      });
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
          method: "dfs_priority_batch",
          task_id: row.taskId,
          item_count: row.items.length,
          task_status: row.taskStatus,
        },
        distanceFromCenterM: job.point.distance_from_center_m,
        lat: job.point.lat,
        lng: job.point.lng,
        passLabel,
      });
      continue;
    }

    results.push(
      await persistPrioritySuccess({
        job,
        items: row.items,
        request: row.request as unknown as Record<string, unknown>,
        timestamp: row.timestamp,
        depth,
        passLabel,
        apiSec,
        scanRetryRound,
      })
    );
  }

  const successCount = results.filter((r) => r.success).length;
  console.log(
    `[Scan] Priority pass ${passLabel}: ${successCount}/${jobs.length} complete (>=${depth} items)`
  );

  return {
    results,
    successCount,
    timings: results.map((r) => r.timings).filter(Boolean) as CellPhaseTimings[],
  };
}
