import { createServiceClient } from "@/lib/db/client";
import { parseGridLabel } from "@/lib/maps/grid-entity";
import { computeSolv } from "@/lib/maps/grid-metrics";
import type { ScanBatchRow, ScanPointRow, ScanResultRow } from "@/lib/db/types";

export type DashboardScanRow = {
  id: string;
  keyword: string | null;
  keywordId: string | null;
  finishedAt: string;
  gridSize: number;
  arp: number | null;
  solv: number | null;
  saiv: number | null;
  change: number | null;
  ranks: Array<number | null>;
  status: string;
};

function buildRankGrid(
  gridSize: number,
  points: ScanPointRow[],
  rankByPointId: Map<string, number | null>
): Array<number | null> {
  const cells: Array<number | null> = Array.from({ length: gridSize * gridSize }, () => null);
  for (const point of points) {
    const { row, col } = parseGridLabel(point.grid_label);
    const idx = row * gridSize + col;
    if (idx >= 0 && idx < cells.length) {
      cells[idx] = rankByPointId.get(point.id) ?? null;
    }
  }
  return cells;
}

export async function loadDashboardRecentScans(
  businessId: string,
  options?: { limit?: number; preview?: number }
): Promise<{ rows: DashboardScanRow[]; total: number }> {
  const limit = options?.limit ?? 40;
  const preview = options?.preview ?? 3;
  const supabase = createServiceClient();

  const { data: batches } = await supabase
    .from("scan_batches")
    .select(
      "id, status, grid_size, created_at, finished_at, aggregate_metrics, confidence_summary"
    )
    .eq("business_id", businessId)
    .in("status", ["ready", "partial", "rank_ready"])
    .order("created_at", { ascending: false })
    .limit(limit);

  const { count: totalCount } = await supabase
    .from("scan_batches")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("status", ["ready", "partial", "rank_ready"]);

  const allBatches = (batches ?? []) as ScanBatchRow[];
  const total = totalCount ?? allBatches.length;
  const previewBatches = allBatches.slice(0, preview);
  if (!previewBatches.length) return { rows: [], total: 0 };

  const batchIds = previewBatches.map((b) => b.id);
  const { data: pointsData } = await supabase
    .from("scan_points")
    .select("id, scan_batch_id, grid_label")
    .in("scan_batch_id", batchIds);

  const pointsByBatch = new Map<string, ScanPointRow[]>();
  const allPointIds: string[] = [];
  for (const p of (pointsData ?? []) as ScanPointRow[]) {
    const list = pointsByBatch.get(p.scan_batch_id) ?? [];
    list.push(p);
    pointsByBatch.set(p.scan_batch_id, list);
    allPointIds.push(p.id);
  }

  const rankByPointId = new Map<string, number | null>();
  if (allPointIds.length) {
    const { data: resultsData } = await supabase
      .from("scan_results")
      .select("scan_point_id, target_rank, keyword_id")
      .in("scan_point_id", allPointIds);

    for (const r of (resultsData ?? []) as ScanResultRow[]) {
      if (!rankByPointId.has(r.scan_point_id)) {
        rankByPointId.set(r.scan_point_id, r.target_rank);
      }
    }
  }

  const solvHistory = new Map<string, Array<{ batchId: string; solv: number }>>();

  for (const batch of allBatches) {
    const conf = (batch.confidence_summary ?? {}) as { keyword_ids?: string[] };
    const keywordId = conf.keyword_ids?.[0];
    if (!keywordId) continue;
    const metrics = (batch.aggregate_metrics ?? {}) as {
      top3Cells?: number;
      totalCells?: number;
    };
    if (metrics.top3Cells == null || !metrics.totalCells) continue;
    const solv = computeSolv(metrics.top3Cells, metrics.totalCells);
    const list = solvHistory.get(keywordId) ?? [];
    list.push({ batchId: batch.id, solv });
    solvHistory.set(keywordId, list);
  }

  function changeForBatch(batchId: string, keywordId: string | null, solv: number | null): number | null {
    if (!keywordId || solv == null) return null;
    const history = solvHistory.get(keywordId);
    if (!history) return null;
    const idx = history.findIndex((h) => h.batchId === batchId);
    if (idx < 0 || idx >= history.length - 1) return null;
    const older = history[idx + 1];
    return Math.round((solv - older.solv) * 10) / 10;
  }

  const rows: DashboardScanRow[] = previewBatches.map((batch) => {
    const conf = (batch.confidence_summary ?? {}) as {
      keyword_label?: string;
      keyword_ids?: string[];
    };
    const keywordId = conf.keyword_ids?.[0] ?? null;
    const keyword = conf.keyword_label ?? null;
    const metrics = (batch.aggregate_metrics ?? {}) as {
      averageRank?: number | null;
      top3Cells?: number;
      totalCells?: number;
      visibilityScore?: number | null;
    };

    const solv =
      metrics.top3Cells != null && metrics.totalCells
        ? computeSolv(metrics.top3Cells, metrics.totalCells)
        : null;
    const saiv =
      metrics.visibilityScore != null ? Math.round(Number(metrics.visibilityScore)) : null;

    let change: number | null = null;
    if (keywordId && solv != null) {
      change = changeForBatch(batch.id, keywordId, solv);
    }

    const points = pointsByBatch.get(batch.id) ?? [];
    const ranks = buildRankGrid(batch.grid_size, points, rankByPointId);

    return {
      id: batch.id,
      keyword,
      keywordId,
      finishedAt: (batch.finished_at as string | null) ?? (batch.created_at as string),
      gridSize: batch.grid_size,
      arp: metrics.averageRank != null ? Math.round(metrics.averageRank * 10) / 10 : null,
      solv,
      saiv,
      change,
      ranks,
      status: batch.status as string,
    };
  });

  return { rows, total };
}
