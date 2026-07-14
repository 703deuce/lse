import { createServiceClient } from "@/lib/db/client";
import { mergeScanConfidenceSummary } from "@/lib/jobs/merge-confidence-summary";
import { refreshScanAggregateMetrics } from "@/lib/jobs/refresh-scan-metrics";
import { invalidateScanGridCache } from "@/lib/maps/scan-queries";

/**
 * After soft-ready + trailing retries finish, sync cells_failed / failed_point_ids
 * to what is actually saved. Soft-ready finalize can race and re-write stale
 * failed ids for cells that later recovered.
 */
export async function reconcileScanCellFailures(
  scanBatchId: string,
  failedCells: number,
  totalCells: number
): Promise<void> {
  const supabase = createServiceClient();

  const { data: points } = await supabase
    .from("scan_points")
    .select("id")
    .eq("scan_batch_id", scanBatchId);
  const pointIds = (points ?? []).map((p) => p.id as string);
  if (!pointIds.length) return;

  const { data: results } = await supabase
    .from("scan_results")
    .select("scan_point_id")
    .in("scan_point_id", pointIds);

  const withResults = new Set(
    (results ?? []).map((r) => r.scan_point_id as string).filter(Boolean)
  );
  const missingIds = pointIds.filter((id) => !withResults.has(id));
  // Prefer the runner's final failed count when it already accounts for recovery;
  // never keep more failed ids than points that still lack a saved result.
  const resolvedFailed = Math.min(
    Math.max(0, failedCells),
    missingIds.length,
    totalCells > 0 ? totalCells : missingIds.length
  );
  const failedPointIds = missingIds.slice(0, resolvedFailed);

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
