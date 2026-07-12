import { createServiceClient } from "@/lib/db/client";
import { computeAggregateMetrics } from "@/lib/maps/grid";

/** Recompute aggregate_metrics from saved scan_results (e.g. after background cells land). */
export async function refreshScanAggregateMetrics(scanBatchId: string): Promise<void> {
  const supabase = createServiceClient();

  const { data: points } = await supabase
    .from("scan_points")
    .select("id")
    .eq("scan_batch_id", scanBatchId);
  const pointIds = (points ?? []).map((p) => p.id);
  if (!pointIds.length) return;

  const { data: results } = await supabase
    .from("scan_results")
    .select("target_rank")
    .in("scan_point_id", pointIds);

  const allRanks = (results ?? []).map((r) => r.target_rank as number | null);
  const aggregateMetrics = computeAggregateMetrics(allRanks);

  const { data: batch } = await supabase
    .from("scan_batches")
    .select("confidence_summary, cells_total, cells_completed, cells_failed")
    .eq("id", scanBatchId)
    .single();

  const conf = (batch?.confidence_summary ?? {}) as Record<string, unknown>;

  await supabase
    .from("scan_batches")
    .update({
      aggregate_metrics: aggregateMetrics,
      confidence_summary: {
        ...conf,
        completed_cells: batch?.cells_completed ?? conf.completed_cells,
        total_cells: batch?.cells_total ?? conf.total_cells,
        failed_cells: batch?.cells_failed ?? conf.failed_cells,
      },
    })
    .eq("id", scanBatchId);
}
