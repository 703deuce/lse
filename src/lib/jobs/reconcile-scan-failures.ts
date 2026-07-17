import { createServiceClient } from "@/lib/db/client";
import { mergeScanConfidenceSummary } from "@/lib/jobs/merge-confidence-summary";
import { refreshScanAggregateMetrics } from "@/lib/jobs/refresh-scan-metrics";
import { mapsDepth } from "@/lib/jobs/run-grid-cells";
import { validateStoredCellResult } from "@/lib/maps/cell-result-integrity";
import { invalidateScanGridCache } from "@/lib/maps/scan-queries";

/**
 * After soft-ready + trailing retries finish, sync cells_failed / failed_point_ids
 * to what is actually saved. Soft-ready finalize can race and re-write stale
 * failed ids for cells that later recovered.
 *
 * Incomplete / sparse SERP rows count as failed — a row existing is not enough.
 * The old "missing row only" check could zero out failures after Bright Data
 * wrote sparse placeholders and made secondary fallback look unnecessary.
 */
export async function reconcileScanCellFailures(
  scanBatchId: string,
  failedCells: number,
  totalCells: number
): Promise<void> {
  const supabase = createServiceClient();
  const depth = mapsDepth();

  const { data: points } = await supabase
    .from("scan_points")
    .select("id")
    .eq("scan_batch_id", scanBatchId);
  const pointIds = (points ?? []).map((p) => p.id as string);
  if (!pointIds.length) return;

  const { data: results } = await supabase
    .from("scan_results")
    .select("scan_point_id, keyword_id, target_found, top_competitors_json")
    .in("scan_point_id", pointIds);

  const completePointIds = new Set<string>();
  for (const row of results ?? []) {
    if (validateStoredCellResult(row, depth).complete) {
      completePointIds.add(row.scan_point_id as string);
    }
  }
  const unresolvedIds = pointIds.filter((id) => !completePointIds.has(id));
  // Prefer the runner's final failed count when it already accounts for recovery;
  // never keep more failed ids than points that still lack a complete result.
  const resolvedFailed = Math.min(
    Math.max(0, failedCells, unresolvedIds.length),
    unresolvedIds.length,
    totalCells > 0 ? totalCells : unresolvedIds.length
  );
  const failedPointIds = unresolvedIds.slice(0, resolvedFailed);

  await supabase
    .from("scan_batches")
    .update({
      cells_total: totalCells > 0 ? totalCells : pointIds.length,
      cells_completed: totalCells > 0 ? totalCells : pointIds.length,
      cells_failed: failedPointIds.length,
    })
    .eq("id", scanBatchId);

  await mergeScanConfidenceSummary(supabase, scanBatchId, {
    completed_cells: totalCells > 0 ? totalCells : pointIds.length,
    total_cells: totalCells > 0 ? totalCells : pointIds.length,
    failed_cells: failedPointIds.length,
    failed_point_ids: failedPointIds,
  });

  await refreshScanAggregateMetrics(scanBatchId);
  invalidateScanGridCache(scanBatchId);
}
