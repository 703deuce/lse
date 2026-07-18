import { createServiceClient } from "@/lib/db/client";
import { parseGridLabel } from "@/lib/maps/grid-entity";
import { computeSolv } from "@/lib/maps/grid-metrics";
import type { ScanBatchRow, ScanPointRow, ScanResultRow } from "@/lib/db/types";
import { isScanActivelyRunning } from "@/lib/scans/status";

export type DashboardScanRow = {
  id: string;
  keyword: string | null;
  keywordId: string | null;
  finishedAt: string;
  gridSize: number;
  radiusMeters: number | null;
  arp: number | null;
  solv: number | null;
  saiv: number | null;
  change: number | null;
  ranks: Array<number | null>;
  status: string;
  totalCells: number;
  completedCells: number;
  unresolvedCells: number;
  progressPercent: number;
  locationLabel: string | null;
  businessName: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  nextRecoveryAt: string | null;
  active: boolean;
};

const DASHBOARD_SCAN_STATUSES = [
  "queued",
  "dispatching",
  "provider_running",
  "recovering",
  "normalizing",
  "ready",
  "partial",
  "rank_ready",
  "failed",
  "cancelled",
] as const;

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
      "id, status, grid_size, radius_meters, created_at, started_at, finished_at, aggregate_metrics, confidence_summary, cells_total, cells_completed, cells_failed, center_label, next_recovery_at, business_id"
    )
    .eq("business_id", businessId)
    .in("status", [...DASHBOARD_SCAN_STATUSES])
    .order("created_at", { ascending: false })
    .limit(limit);

  const { count: totalCount } = await supabase
    .from("scan_batches")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .in("status", [...DASHBOARD_SCAN_STATUSES]);

  const allBatches = (batches ?? []) as Array<
    ScanBatchRow & {
      cells_total?: number | null;
      cells_completed?: number | null;
      cells_failed?: number | null;
      radius_meters?: number | null;
      next_recovery_at?: string | null;
    }
  >;
  const total = totalCount ?? allBatches.length;
  const previewBatches = allBatches.slice(0, preview);
  if (!previewBatches.length) return { rows: [], total: 0 };

  const { data: business } = await supabase
    .from("businesses")
    .select("name")
    .eq("id", businessId)
    .maybeSingle();
  const businessName = (business?.name as string | null) ?? null;

  const keywordIds = Array.from(
    new Set(
      previewBatches
        .map((b) => {
          const conf = (b.confidence_summary ?? {}) as { keyword_ids?: string[] };
          return conf.keyword_ids?.[0] ?? null;
        })
        .filter((id): id is string => Boolean(id))
    )
  );
  const keywordById = new Map<string, string>();
  if (keywordIds.length) {
    const { data: keywords } = await supabase
      .from("business_keywords")
      .select("id, keyword")
      .eq("business_id", businessId)
      .in("id", keywordIds);
    for (const k of keywords ?? []) {
      keywordById.set(k.id as string, String(k.keyword).trim());
    }
  }

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

    const preferredKeywordByBatch = new Map<string, string | null>();
    for (const batch of previewBatches) {
      const conf = (batch.confidence_summary ?? {}) as { keyword_ids?: string[] };
      preferredKeywordByBatch.set(batch.id, conf.keyword_ids?.[0] ?? null);
    }

    const pointToBatch = new Map<string, string>();
    for (const p of (pointsData ?? []) as ScanPointRow[]) {
      pointToBatch.set(p.id, p.scan_batch_id);
    }

    for (const r of (resultsData ?? []) as ScanResultRow[]) {
      const batchId = pointToBatch.get(r.scan_point_id);
      const preferred = batchId ? preferredKeywordByBatch.get(batchId) : null;
      if (preferred && r.keyword_id !== preferred) continue;
      if (!rankByPointId.has(r.scan_point_id)) {
        rankByPointId.set(r.scan_point_id, r.target_rank);
      }
    }
  }

  const solvHistory = new Map<string, Array<{ batchId: string; solv: number }>>();

  for (const batch of allBatches) {
    if (isScanActivelyRunning(batch.status as string)) continue;
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
      unresolved_cells?: number;
      progress_percent?: number;
    };
    const keywordId = conf.keyword_ids?.[0] ?? null;
    const label = conf.keyword_label?.trim() || "";
    const keyword =
      label ||
      (keywordId ? keywordById.get(keywordId) : null) ||
      (keywordId ? "Historical scan" : null);
    const metrics = (batch.aggregate_metrics ?? {}) as {
      averageRank?: number | null;
      top3Cells?: number;
      totalCells?: number;
      visibilityScore?: number | null;
    };

    const active = isScanActivelyRunning(batch.status as string);
    const totalCells = Number(batch.cells_total ?? metrics.totalCells ?? 0);
    const completedCells = Number(batch.cells_completed ?? 0);
    const unresolvedCells = active
      ? Math.max(
          0,
          Number(conf.unresolved_cells ?? Math.max(0, totalCells - completedCells))
        )
      : Number(batch.cells_failed ?? 0);
    const progressPercent =
      totalCells > 0
        ? Math.min(100, Math.round((completedCells / totalCells) * 100))
        : Number(conf.progress_percent ?? 0);

    const solv =
      !active && metrics.top3Cells != null && metrics.totalCells
        ? computeSolv(metrics.top3Cells, metrics.totalCells)
        : null;
    const saiv =
      !active && metrics.visibilityScore != null
        ? Math.round(Number(metrics.visibilityScore))
        : null;

    let change: number | null = null;
    if (!active && keywordId && solv != null) {
      change = changeForBatch(batch.id, keywordId, solv);
    }

    const points = pointsByBatch.get(batch.id) ?? [];
    const ranks = active ? [] : buildRankGrid(batch.grid_size, points, rankByPointId);

    return {
      id: batch.id,
      keyword,
      keywordId,
      finishedAt: (batch.finished_at as string | null) ?? (batch.created_at as string),
      gridSize: batch.grid_size,
      radiusMeters: (batch.radius_meters as number | null) ?? null,
      arp: !active && metrics.averageRank != null ? Math.round(metrics.averageRank * 10) / 10 : null,
      solv,
      saiv,
      change,
      ranks,
      status: batch.status as string,
      totalCells,
      completedCells,
      unresolvedCells,
      progressPercent,
      locationLabel: (batch.center_label as string | null) ?? null,
      businessName,
      createdAt: batch.created_at as string,
      startedAt: (batch.started_at as string | null) ?? null,
      completedAt: (batch.finished_at as string | null) ?? null,
      nextRecoveryAt: (batch.next_recovery_at as string | null) ?? null,
      active,
    };
  });

  return { rows, total };
}
