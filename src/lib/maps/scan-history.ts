import type { createServiceClient } from "@/lib/db/client";
import { computeAggregateMetrics } from "@/lib/maps/grid";
import { computeSolv } from "@/lib/maps/grid-metrics";
import {
  buildEntityGridCells,
  buildYouEntity,
  entitiesFromTopCompetitors,
  entityKeyFromParts,
  findEntityInCompetitors,
  type GridEntityRef,
} from "@/lib/maps/grid-entity";
import { buildGridTopCompetitors } from "@/lib/maps/grid";
import type { BusinessRow, ScanBatchRow, ScanPointRow, ScanResultRow } from "@/lib/db/types";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type ScanHistoryEntry = {
  scan_id: string;
  keyword: string | null;
  keyword_id: string | null;
  location_id: string | null;
  center_lat: number | null;
  center_lng: number | null;
  center_label: string | null;
  grid_size: number;
  radius_meters: number;
  completed_at: string;
  avg_rank: number | null;
  top3_count: number;
  visibility_score: number | null;
  solv: number | null;
};

export async function loadScanHistory(
  supabase: ServiceClient,
  params: {
    businessId: string;
    keywordId?: string | null;
    locationId?: string | null;
    gridSize?: number | null;
    radiusMeters?: number | null;
    mode?: "target" | "competitor" | "keyword";
    competitorKey?: string | null;
  }
): Promise<ScanHistoryEntry[]> {
  let query = supabase
    .from("scan_batches")
    .select(
      "id, grid_size, radius_meters, created_at, finished_at, location_id, center_lat, center_lng, center_label, aggregate_metrics, confidence_summary"
    )
    .eq("business_id", params.businessId)
    .in("status", ["ready", "partial", "rank_ready"])
    .order("created_at", { ascending: true })
    .limit(100);

  if (params.gridSize) query = query.eq("grid_size", params.gridSize);
  if (params.radiusMeters) query = query.eq("radius_meters", params.radiusMeters);
  if (params.locationId) query = query.eq("location_id", params.locationId);
  else if (params.locationId === null) query = query.is("location_id", null);

  const { data: batches } = await query;
  const entries: ScanHistoryEntry[] = [];

  for (const batch of (batches ?? []) as ScanBatchRow[]) {
    const confidence = (batch.confidence_summary ?? {}) as {
      keyword_label?: string;
      keyword_ids?: string[];
    };
    const keyword = confidence.keyword_label ?? null;

    const { data: points } = await supabase
      .from("scan_points")
      .select("id")
      .eq("scan_batch_id", batch.id);
    const pointIds = (points ?? []).map((p) => p.id);
    if (!pointIds.length) continue;

    let resultsQuery = supabase
      .from("scan_results")
      .select("target_rank, top_competitors_json, keyword_id")
      .in("scan_point_id", pointIds);
    if (params.keywordId) resultsQuery = resultsQuery.eq("keyword_id", params.keywordId);

    const { data: results } = await resultsQuery;
    const rows = (results ?? []) as ScanResultRow[];
    if (!rows.length) continue;

    const keywordId =
      (params.keywordId ?? confidence.keyword_ids?.[0] ?? rows[0]?.keyword_id) ?? null;
    if (params.keywordId && keywordId !== params.keywordId) continue;

    if (params.mode === "competitor" && params.competitorKey) {
      const entity = parseEntityKey(params.competitorKey);
      const hasCompetitor = rows.some((r) => {
        const comps = (r.top_competitors_json ?? []) as Array<{ cid?: string; place_id?: string; name?: string }>;
        return findEntityInCompetitors(comps, entity).found;
      });
      if (!hasCompetitor) continue;
    }

    const metrics = (batch.aggregate_metrics ?? {}) as {
      averageRank?: number | null;
      top3Cells?: number;
      visibilityScore?: number | null;
      totalCells?: number;
    };

    const ranks = rows.map((r) => r.target_rank as number | null);
    const computed = computeAggregateMetrics(ranks);

    entries.push({
      scan_id: batch.id,
      keyword,
      keyword_id: keywordId,
      location_id: batch.location_id ?? null,
      center_lat: batch.center_lat ?? null,
      center_lng: batch.center_lng ?? null,
      center_label: batch.center_label ?? null,
      grid_size: batch.grid_size,
      radius_meters: batch.radius_meters,
      completed_at: batch.finished_at ?? batch.created_at,
      avg_rank: metrics.averageRank ?? computed.averageRank,
      top3_count: metrics.top3Cells ?? computed.top3Cells,
      visibility_score: metrics.visibilityScore ?? computed.visibilityScore,
      solv: computeSolv(metrics.top3Cells ?? computed.top3Cells, metrics.totalCells ?? computed.totalCells),
    });
  }

  return entries;
}

function parseEntityKey(key: string): GridEntityRef {
  if (key === "you") return { key, label: "You", isTarget: true };
  if (key.startsWith("cid:")) return { key, label: "", cid: key.slice(4), isTarget: false };
  if (key.startsWith("place:")) return { key, label: "", place_id: key.slice(6), isTarget: false };
  if (key.startsWith("name:")) return { key, label: key.slice(5), name: key.slice(5), isTarget: false };
  return { key, label: key, isTarget: false };
}

export async function renderGridForEntity(
  supabase: ServiceClient,
  scanId: string,
  options: {
    keywordId?: string | null;
    entityKey?: string;
    competitorId?: string | null;
  }
) {
  const { loadScanGridData } = await import("@/lib/maps/scan-queries");
  const gridData = await loadScanGridData(supabase, scanId, options.keywordId);
  if (!gridData) return null;

  const business = (gridData.business ?? {}) as BusinessRow;
  const you = buildYouEntity(business);
  const points = gridData.points as ScanPointRow[];
  const results = gridData.results as ScanResultRow[];

  let entity: GridEntityRef = you;
  if (options.entityKey && options.entityKey !== "you") {
    entity = parseEntityKey(options.entityKey);
    const locationTokens = [gridData.activeKeyword?.city, gridData.activeKeyword?.state].filter(
      (t): t is string => !!t?.trim()
    );
    const top = buildGridTopCompetitors(results, {
      excludeCid: business.cid,
      excludePlaceId: business.place_id,
      excludeName: business.name,
      keyword: gridData.activeKeyword?.keyword,
      locationTokens,
      limit: 10,
    });
    const found = entitiesFromTopCompetitors(top, 10).find((e) => e.key === options.entityKey);
    if (found) entity = found;
  } else if (options.competitorId) {
    const { data: comp } = await supabase
      .from("competitors")
      .select("*")
      .eq("id", options.competitorId)
      .maybeSingle();
    if (comp) {
      entity = {
        key: entityKeyFromParts(comp),
        label: comp.name,
        cid: comp.cid,
        place_id: comp.place_id,
        name: comp.name,
        isTarget: false,
      };
    }
  }

  const cells = buildEntityGridCells(points, results, entity);
  return { entity, cells, batch: gridData.batch, keyword: gridData.activeKeyword };
}
