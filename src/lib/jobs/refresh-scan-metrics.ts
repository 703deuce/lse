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

  // Only touch aggregate_metrics — do not rewrite confidence_summary (avoids racing cell progress).
  await supabase
    .from("scan_batches")
    .update({
      aggregate_metrics: aggregateMetrics,
    })
    .eq("id", scanBatchId);
}
