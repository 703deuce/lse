import { createServiceClient } from "@/lib/db/client";
import { computeAggregateMetrics } from "@/lib/maps/grid";
import { invalidateScanGridCache } from "@/lib/maps/scan-queries";
import { validateStoredCellResult } from "@/lib/maps/cell-result-integrity";
import { mapsDepth } from "@/lib/jobs/run-grid-cells";
import { SCAN_RESULT_COMPETITOR_COLUMNS } from "@/lib/maps/scan-result-columns";

function gridScanAutoEnrichment(): boolean {
  return process.env.GRID_SCAN_AUTO_ENRICHMENT === "true";
}

/**
 * Phase 1 — mark scan rank-ready as soon as grid cells are saved. Map is usable.
 * Enrichment is opt-in only (GRID_SCAN_AUTO_ENRICHMENT=true); grid scans do not run it by default.
 *
 * Uses a conditional status claim so soft-ready + end-of-scan (or duplicate soft-ready)
 * cannot run finalize twice.
 */
export async function finalizeRankReady(
  scanBatchId: string,
  organizationId?: string,
  failedCells = 0,
  totalCells = 0
): Promise<void> {
  const supabase = createServiceClient();

  // Claim: only one finalize may leave provider_running/dispatching → normalizing.
  const { data: claimed } = await supabase
    .from("scan_batches")
    .update({ status: "normalizing" })
    .eq("id", scanBatchId)
    .in("status", ["provider_running", "dispatching"])
    .select("*")
    .maybeSingle();

  if (!claimed) {
    console.log("[finalizeRankReady] skip — already claimed or not in-flight", scanBatchId);
    return;
  }

  const batch = claimed;

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
  const conf = ((latest?.confidence_summary ?? batch.confidence_summary ?? {}) as Record<string, unknown>);
  const failedPointIds = Array.isArray(conf.failed_point_ids) ? conf.failed_point_ids : [];

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
      enrichment_status: gridScanAutoEnrichment() ? "pending" : "skipped",
      aggregate_metrics: aggregateMetrics,
      cells_total: totalCells,
      cells_completed: cellsCompleted,
      cells_failed: actualFailed,
      rank_ready_at: rankReadyAt,
      confidence_summary: {
        ...conf,
        provider: conf.provider ?? "brightdata",
        method: conf.method ?? batch.scan_type,
        completed_cells: cellsCompleted,
        total_cells: totalCells,
        failed_cells: actualFailed,
        failed_point_ids: failedPointIds,
        sparse_point_ids: sparsePointIds,
        sparse_cells: sparsePointIds.length,
        provider_error: hasEmptyProviderData
          ? "Bright Data returned no map results — check BRIGHTDATA_API_KEY, BRIGHTDATA_ZONE (serp_api1), and account credits"
          : conf.provider_error,
      },
      error_message: hasEmptyProviderData
        ? "Bright Data returned empty results for all cells"
        : sparsePointIds.length > 0
          ? `${sparsePointIds.length} cell${sparsePointIds.length === 1 ? "" : "s"} returned sparse Maps data (rank may show without competitors).`
          : failedCells > 0
            ? `${failedCells} of ${totalCells} points failed. Rank map is still usable.`
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

  invalidateScanGridCache(scanBatchId);

  if (gridScanAutoEnrichment()) {
    const { runScanEnrichment } = await import("@/lib/jobs/run-scan-enrichment");
    void runScanEnrichment(scanBatchId, organizationId).catch((err) => {
      console.error("[runScanEnrichment] background", scanBatchId, err);
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
