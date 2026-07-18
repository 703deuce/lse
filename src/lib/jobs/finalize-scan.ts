import { createServiceClient } from "@/lib/db/client";
import { computeAggregateMetrics } from "@/lib/maps/grid";
import { invalidateScanGridCache } from "@/lib/maps/scan-queries";
import { invalidateWorkspaceCache } from "@/lib/maps/workspace-cache";
import { validateStoredCellResult } from "@/lib/maps/cell-result-integrity";
import { mapsDepth } from "@/lib/jobs/run-grid-cells";
import { SCAN_RESULT_COMPETITOR_COLUMNS } from "@/lib/maps/scan-result-columns";
import { mergeScanConfidenceSummary } from "@/lib/jobs/merge-confidence-summary";
import { gridScanAutoEnrichmentEnabled } from "@/lib/jobs/grid-scan-enrichment-flag";

/**
 * Phase 1 — mark scan rank-ready as soon as grid cells are saved. Map is usable.
 * Enrichment is opt-in only (GRID_SCAN_AUTO_ENRICHMENT=true); grid scans do not run it by default.
 *
 * Uses a conditional status claim so soft-ready + end-of-scan (or duplicate soft-ready)
 * cannot run finalize twice. Confidence keys are merged (not replaced) so progress
 * / early-enrichment flags survive.
 */
export async function finalizeRankReady(
  scanBatchId: string,
  organizationId?: string,
  failedCells = 0,
  totalCells = 0
): Promise<void> {
  const supabase = createServiceClient();

  console.log(`[Finalization] scan=${scanBatchId} START`);

  // Idempotent guard: all expected cells must be complete before finalizing.
  {
    const { countScanCellProgress } = await import("@/lib/jobs/scan-cell-state");
    const progress = await countScanCellProgress(scanBatchId);
    if (progress.totalCells > 0 && progress.unresolvedCells > 0) {
      console.log(
        `[Finalization] scan=${scanBatchId} skip — unresolved=${progress.unresolvedCells}`
      );
      // Keep/restore recovering so background jobs continue.
      await supabase
        .from("scan_batches")
        .update({
          status: "recovering",
          cells_completed: progress.completedCells,
          cells_total: progress.totalCells,
          cells_failed: 0,
          updated_at: new Date().toISOString(),
        })
        .eq("id", scanBatchId)
        .in("status", ["provider_running", "dispatching", "recovering", "normalizing"]);
      return;
    }
  }

  // Claim: only one finalize may leave running/recovering → normalizing (finalizing).
  const { data: claimed } = await supabase
    .from("scan_batches")
    .update({ status: "normalizing" })
    .eq("id", scanBatchId)
    .in("status", ["provider_running", "dispatching", "recovering"])
    .select("*")
    .maybeSingle();

  let batch = claimed;
  if (!batch) {
    // Resume finalize if a prior claim stuck in `normalizing` (worker crash).
    const nowIso = new Date().toISOString();
    const { data: stuck } = await supabase
      .from("scan_batches")
      .update({
        status: "normalizing",
        heartbeat_at: nowIso,
      })
      .eq("id", scanBatchId)
      .eq("status", "normalizing")
      .or(`lease_expires_at.is.null,lease_expires_at.lt.${nowIso}`)
      .select("*")
      .maybeSingle();
    if (!stuck) {
      console.log("[finalizeRankReady] skip — already claimed or not in-flight", scanBatchId);
      return;
    }
    console.log("[finalizeRankReady] resuming stuck normalizing", scanBatchId);
    batch = stuck;
  }

  const { data: business } = await supabase.from("businesses").select("*").eq("id", batch.business_id).single();
  if (!business) throw new Error("Business not found");

  const { data: keywords } = await supabase.from("business_keywords").select("*").eq("business_id", business.id);
  const primaryKeyword = keywords?.find((k) => k.is_primary) ?? keywords?.[0];
  if (!primaryKeyword) throw new Error("No keywords configured");

  const { data: points } = await supabase
    .from("scan_points")
    .select("id, distance_from_center_m")
    .eq("scan_batch_id", scanBatchId);
  const pointIds = (points ?? []).map((p) => p.id);
  const { data: results } = pointIds.length
    ? await supabase
        .from("scan_results")
        .select(SCAN_RESULT_COMPETITOR_COLUMNS)
        .in("scan_point_id", pointIds)
    : { data: [] };

  const allRanks = (results ?? []).map((r) => r.target_rank as number | null);
  const aggregateMetrics = computeAggregateMetrics(allRanks);

  const depth = mapsDepth();
  const sparsePointIds = (results ?? [])
    .filter((r) => !validateStoredCellResult(r, depth).complete)
    .map((r) => r.scan_point_id as string);

  const hasEmptyProviderData =
    (results ?? []).length > 0 &&
    (results ?? []).every(
      (r) =>
        !r.target_found &&
        !(Array.isArray(r.top_competitors_json) && (r.top_competitors_json as unknown[]).length > 0)
    );

  const rankReadyAt = new Date().toISOString();

  const actualCompleted = (results ?? []).length;
  const actualFailed = Math.max(0, failedCells);
  const cellsCompleted = Math.min(actualCompleted, totalCells > 0 ? totalCells : actualCompleted);

  // Re-read progress fields — cells may still settle while we normalize.
  const { data: latest } = await supabase
    .from("scan_batches")
    .select("confidence_summary")
    .eq("id", scanBatchId)
    .eq("status", "normalizing")
    .maybeSingle();
  const conf = (latest?.confidence_summary ?? batch.confidence_summary ?? {}) as Record<string, unknown>;

  if (actualFailed >= totalCells || (totalCells > 0 && actualFailed > totalCells * 0.5 && actualCompleted === 0)) {
    const { data: failedRow } = await supabase
      .from("scan_batches")
      .update({
        status: "failed",
        rank_status: "failed",
        enrichment_status: "skipped",
        aggregate_metrics: aggregateMetrics,
        cells_total: totalCells,
        cells_completed: cellsCompleted,
        cells_failed: actualFailed,
        error_message: "All scan points failed",
        finished_at: rankReadyAt,
      })
      .eq("id", scanBatchId)
      .eq("status", "normalizing")
      .select("id")
      .maybeSingle();
    if (!failedRow) {
      console.log("[finalizeRankReady] failed write skipped — status moved", scanBatchId);
    }
    return;
  }

  const { data: readyRow } = await supabase
    .from("scan_batches")
    .update({
      status: "rank_ready",
      rank_status: "ready",
      enrichment_status: gridScanAutoEnrichmentEnabled() ? "pending" : "skipped",
      aggregate_metrics: aggregateMetrics,
      cells_total: totalCells,
      cells_completed: cellsCompleted,
      cells_failed: actualFailed,
      rank_ready_at: rankReadyAt,
      // Explicit "grid is done" timestamp for the client wait UI (reload already works;
      // this is what live polling must observe to reveal the map).
      finished_at: rankReadyAt,
      error_message: hasEmptyProviderData
        ? "Bright Data returned empty results for all cells"
        : sparsePointIds.length > 0
          ? `${sparsePointIds.length} cell${sparsePointIds.length === 1 ? "" : "s"} returned sparse Maps data (rank may show without competitors).`
          : null,
    })
    .eq("id", scanBatchId)
    .eq("status", "normalizing")
    .select("id")
    .maybeSingle();

  if (!readyRow) {
    console.log("[finalizeRankReady] rank_ready write skipped — status moved", scanBatchId);
    return;
  }

  console.log(
    `[Finalization] scan=${scanBatchId} COMPLETE total=${totalCells || actualCompleted}`
  );

  // Merge confidence keys — do not replace the whole document (preserves progress / early flags).
  // Do NOT write failed_point_ids here. Soft-ready races with trailing retries; a mid-flight
  // failed id can be merged after the cell already recovered and stick as a permanent ✕ on the map.
  // Progress writers + reconcileScanCellFailures own the final failed-point list.
  const confidencePatch: Record<string, unknown> = {
    provider: conf.provider ?? "brightdata",
    method: conf.method ?? batch.scan_type,
    completed_cells: cellsCompleted,
    total_cells: totalCells,
    failed_cells: actualFailed,
    sparse_point_ids: sparsePointIds,
    sparse_cells: sparsePointIds.length,
  };
  if (hasEmptyProviderData) {
    confidencePatch.provider_error =
      "Bright Data returned no map results — check BRIGHTDATA_API_KEY, BRIGHTDATA_ZONE (serp_api1), and account credits";
  } else if (conf.provider_error) {
    confidencePatch.provider_error = conf.provider_error;
  }
  await mergeScanConfidenceSummary(supabase, scanBatchId, confidencePatch);

  invalidateScanGridCache(scanBatchId);
  await invalidateWorkspaceCache(supabase, scanBatchId);

  if (gridScanAutoEnrichmentEnabled()) {
    const { dispatchFeatureJob } = await import("@/lib/queue/dispatch");
    await dispatchFeatureJob({
      jobType: "scan_enrichment",
      payload: { scanBatchId, organizationId },
      organizationId,
      idempotencyKey: `scan-enrichment:${scanBatchId}`,
      priority: "normal",
      maxAttempts: 2,
    }).catch((err) => {
      console.error("[runScanEnrichment] enqueue failed", scanBatchId, err);
    });
  }
}

/** @deprecated Use finalizeRankReady — kept for imports that expect blocking finalize */
export async function finalizeScanBatch(
  scanBatchId: string,
  organizationId?: string,
  failedCells = 0,
  totalCells = 0
): Promise<void> {
  await finalizeRankReady(scanBatchId, organizationId, failedCells, totalCells);
}
