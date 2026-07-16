import type { createServiceClient } from "@/lib/db/client";
import { computeSolv } from "@/lib/maps/grid-metrics";
import { computeAggregateMetrics } from "@/lib/maps/grid";
import { isMapRenderable } from "@/lib/scans/status";
import {
  dedupeScanResults,
  pickScanResultForPoint,
} from "@/lib/maps/cell-result-integrity";
import { SCAN_RESULT_GRID_COLUMNS } from "@/lib/maps/scan-result-columns";
import type { BusinessKeywordRow, BusinessRow, ScanBatchRow, ScanPointRow, ScanResultRow } from "@/lib/db/types";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type KeywordScanSummary = {
  id: string;
  keyword: string;
  isPrimary: boolean;
  latestScanId: string | null;
  latestRank: number | null;
  solv: number | null;
  visibilityScore: number | null;
  lastScannedAt: string | null;
  hasScanForGrid: boolean;
};

export type LocationScanSummary = {
  id: string | null;
  name: string;
  address: string | null;
  city: string | null;
  state: string | null;
  lat: number;
  lng: number;
  defaultGridSize: number;
  defaultRadiusMiles: number;
  latestScanId: string | null;
  latestRank: number | null;
  solv: number | null;
  lastScannedAt: string | null;
  isBusinessLocation: boolean;
};

export async function findKeywordByText(
  supabase: ServiceClient,
  businessId: string,
  keyword: string
) {
  const trimmed = keyword.trim();
  const { data: keywords } = await supabase
    .from("business_keywords")
    .select("*")
    .eq("business_id", businessId);

  const list = (keywords ?? []) as BusinessKeywordRow[];
  return list.find((k) => String(k.keyword).trim() === trimmed) ?? null;
}

export async function findLatestScanForKeyword(
  supabase: ServiceClient,
  params: {
    businessId: string;
    keywordId: string;
    gridSize: number;
    radiusMeters: number;
    locationId?: string | null;
    centerLat?: number | null;
    centerLng?: number | null;
  }
) {
  let query = supabase
    .from("scan_batches")
    .select("id, created_at, finished_at, status, aggregate_metrics, center_lat, center_lng, center_label, location_id")
    .eq("business_id", params.businessId)
    .eq("grid_size", params.gridSize)
    .eq("radius_meters", params.radiusMeters)
    .in("status", ["ready", "partial", "rank_ready"])
    .order("created_at", { ascending: false })
    .limit(30);

  if (params.locationId) {
    query = query.eq("location_id", params.locationId);
  } else if (params.locationId === null) {
    query = query.is("location_id", null);
  }

  const { data: batches } = await query;

  for (const batch of (batches ?? []) as ScanBatchRow[]) {
    if (
      params.centerLat != null &&
      params.centerLng != null &&
      batch.center_lat != null &&
      batch.center_lng != null
    ) {
      const dLat = Math.abs(batch.center_lat - params.centerLat);
      const dLng = Math.abs(batch.center_lng - params.centerLng);
      if (dLat > 0.0001 || dLng > 0.0001) continue;
    }

    const { data: points } = await supabase
      .from("scan_points")
      .select("id")
      .eq("scan_batch_id", batch.id);
    const pointIds = (points ?? []).map((p) => p.id);
    if (!pointIds.length) continue;

    const { count } = await supabase
      .from("scan_results")
      .select("id", { count: "exact", head: true })
      .in("scan_point_id", pointIds)
      .eq("keyword_id", params.keywordId);

    if ((count ?? 0) > 0) {
      return batch;
    }
  }
  return null;
}

export async function scanHasKeywordResults(
  supabase: ServiceClient,
  scanId: string,
  keywordId: string
): Promise<boolean> {
  const { data: points } = await supabase
    .from("scan_points")
    .select("id")
    .eq("scan_batch_id", scanId);
  const pointIds = (points ?? []).map((p) => p.id);
  if (!pointIds.length) return false;

  const { count } = await supabase
    .from("scan_results")
    .select("id", { count: "exact", head: true })
    .in("scan_point_id", pointIds)
    .eq("keyword_id", keywordId);

  return (count ?? 0) > 0;
}

export async function loadKeywordScanSummaries(
  supabase: ServiceClient,
  businessId: string,
  gridSize: number,
  radiusMeters: number,
  locationId?: string | null
): Promise<KeywordScanSummary[]> {
  const { data: keywords } = await supabase
    .from("business_keywords")
    .select("*")
    .eq("business_id", businessId)
    .order("is_primary", { ascending: false })
    .order("created_at", { ascending: true });

  const summaries: KeywordScanSummary[] = [];

  for (const kw of (keywords ?? []) as BusinessKeywordRow[]) {
    const batch = await findLatestScanForKeyword(supabase, {
      businessId,
      keywordId: kw.id,
      gridSize,
      radiusMeters,
      locationId,
    });

    let latestRank: number | null = null;
    let solv: number | null = null;
    let visibilityScore: number | null = null;

    if (batch) {
      const { data: points } = await supabase
        .from("scan_points")
        .select("id")
        .eq("scan_batch_id", batch.id);
      const pointIds = (points ?? []).map((p) => p.id);
      const { data: results } = pointIds.length
        ? await supabase
            .from("scan_results")
            .select("target_rank")
            .in("scan_point_id", pointIds)
            .eq("keyword_id", kw.id)
        : { data: [] };

      const ranks = (results ?? []).map((r) => r.target_rank as number | null);
      const metrics = computeAggregateMetrics(ranks);
      latestRank = metrics.averageRank;
      solv = computeSolv(metrics.top3Cells, metrics.totalCells);
      visibilityScore = metrics.visibilityScore;
    }

    summaries.push({
      id: kw.id,
      keyword: String(kw.keyword).trim(),
      isPrimary: !!kw.is_primary,
      latestScanId: batch?.id ?? null,
      latestRank,
      solv,
      visibilityScore,
      lastScannedAt: batch?.finished_at ?? batch?.created_at ?? null,
      hasScanForGrid: !!batch,
    });
  }

  return summaries;
}

export async function loadLocationScanSummaries(
  supabase: ServiceClient,
  businessId: string,
  keywordId: string,
  gridSize: number,
  radiusMeters: number
): Promise<LocationScanSummary[]> {
  const { data: business } = await supabase
    .from("businesses")
    .select("name, address_text, lat, lng, scan_center_lat, scan_center_lng")
    .eq("id", businessId)
    .single();

  const { data: locations } = await supabase
    .from("rank_locations")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: true });

  const summaries: LocationScanSummary[] = [];

  const bizLat = (business?.scan_center_lat as number | null) ?? (business?.lat as number) ?? 0;
  const bizLng = (business?.scan_center_lng as number | null) ?? (business?.lng as number) ?? 0;

  const bizBatch = await findLatestScanForKeyword(supabase, {
    businessId,
    keywordId,
    gridSize,
    radiusMeters,
    locationId: null,
  });

  let bizRank: number | null = null;
  let bizSolv: number | null = null;
  if (bizBatch?.aggregate_metrics) {
    const m = bizBatch.aggregate_metrics as { averageRank?: number; top3Cells?: number; totalCells?: number };
    bizRank = m.averageRank ?? null;
    bizSolv = computeSolv(m.top3Cells ?? 0, m.totalCells ?? 0);
  }

  summaries.push({
    id: null,
    name: "Business location",
    address: (business?.address_text as string | null) ?? null,
    city: null,
    state: null,
    lat: bizLat,
    lng: bizLng,
    defaultGridSize: gridSize,
    defaultRadiusMiles: Math.round((radiusMeters / 1609.344) * 10) / 10,
    latestScanId: bizBatch?.id ?? null,
    latestRank: bizRank,
    solv: bizSolv,
    lastScannedAt: bizBatch?.finished_at ?? bizBatch?.created_at ?? null,
    isBusinessLocation: true,
  });

  for (const loc of locations ?? []) {
    const batch = await findLatestScanForKeyword(supabase, {
      businessId,
      keywordId,
      gridSize,
      radiusMeters,
      locationId: loc.id as string,
    });

    let latestRank: number | null = null;
    let solv: number | null = null;
    if (batch?.aggregate_metrics) {
      const m = batch.aggregate_metrics as { averageRank?: number; top3Cells?: number; totalCells?: number };
      latestRank = m.averageRank ?? null;
      solv = computeSolv(m.top3Cells ?? 0, m.totalCells ?? 0);
    }

    summaries.push({
      id: loc.id as string,
      name: String(loc.name),
      address: (loc.address as string | null) ?? null,
      city: (loc.city as string | null) ?? null,
      state: (loc.state as string | null) ?? null,
      lat: loc.lat as number,
      lng: loc.lng as number,
      defaultGridSize: (loc.default_grid_size as number) ?? gridSize,
      defaultRadiusMiles: Number(loc.default_radius_miles ?? 5),
      latestScanId: batch?.id ?? null,
      latestRank,
      solv,
      lastScannedAt: batch?.finished_at ?? batch?.created_at ?? null,
      isBusinessLocation: false,
    });
  }

  return summaries;
}

export type ScanGridData = {
  batch: ScanBatchRow;
  business: BusinessRow | null;
  keywords: BusinessKeywordRow[];
  activeKeyword: BusinessKeywordRow | undefined;
  points: ScanPointRow[];
  results: ScanResultRow[];
};

const GRID_DATA_TTL_MS = 10 * 60 * 1000;
const gridDataMemory = new Map<string, { data: ScanGridData; expiresAt: number }>();
const gridDataInflight = new Map<string, Promise<ScanGridData | null>>();

function gridDataMemoryKey(scanId: string, keywordId?: string | null): string {
  return `${scanId}:${keywordId ?? ""}`;
}

export function invalidateScanGridCache(scanId: string): void {
  for (const key of [...gridDataMemory.keys()]) {
    if (key.startsWith(`${scanId}:`)) gridDataMemory.delete(key);
  }
  for (const key of [...gridDataInflight.keys()]) {
    if (key.startsWith(`${scanId}:`)) gridDataInflight.delete(key);
  }
}

function shouldCacheGridData(data: ScanGridData): boolean {
  if (!data.points.length) return false;
  return isMapRenderable(data.batch.status);
}

async function fetchScanGridData(
  supabase: ServiceClient,
  scanId: string,
  keywordId?: string | null
): Promise<ScanGridData | null> {
  const { data: batch } = await supabase.from("scan_batches").select("*").eq("id", scanId).single();
  if (!batch) return null;

  const businessId = batch.business_id as string;

  const [businessResult, keywordsResult, pointsResult] = await Promise.all([
    supabase
      .from("businesses")
      .select(
        "id, organization_id, name, cid, place_id, lat, lng, scan_center_lat, scan_center_lng, address_text, primary_category, phone, website_url"
      )
      .eq("id", businessId)
      .single(),
    supabase.from("business_keywords").select("*").eq("business_id", businessId),
    supabase.from("scan_points").select("*").eq("scan_batch_id", scanId).order("grid_label"),
  ]);

  const batchRow = batch as ScanBatchRow;
  const keywordRows = (keywordsResult.data ?? []) as BusinessKeywordRow[];
  const conf = (batchRow.confidence_summary ?? {}) as { keyword_ids?: string[] };
  const scopedKeywordId = conf.keyword_ids?.[0] ?? null;

  // Prefer explicit keywordId, then the scan's scoped keyword, then primary.
  const activeKeyword =
    (keywordId ? keywordRows.find((k) => k.id === keywordId) : null) ??
    (scopedKeywordId ? keywordRows.find((k) => k.id === scopedKeywordId) : null) ??
    keywordRows.find((k) => k.is_primary) ??
    keywordRows[0];

  const points = (pointsResult.data ?? []) as ScanPointRow[];
  const pointIds = points.map((p) => p.id);
  let results: ScanResultRow[] = [];
  if (pointIds.length) {
    let query = supabase.from("scan_results").select(SCAN_RESULT_GRID_COLUMNS).in("scan_point_id", pointIds);
    if (activeKeyword?.id) {
      query = query.eq("keyword_id", activeKeyword.id);
    }
    const { data } = await query;
    results = dedupeScanResults((data ?? []) as unknown as ScanResultRow[]);
  }

  return {
    batch: batchRow,
    business: (businessResult.data as BusinessRow | null) ?? null,
    keywords: keywordRows,
    activeKeyword,
    points,
    results,
  };
}

export async function loadScanGridData(
  supabase: ServiceClient,
  scanId: string,
  keywordId?: string | null
): Promise<ScanGridData | null> {
  const memKey = gridDataMemoryKey(scanId, keywordId);
  const cached = gridDataMemory.get(memKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const inflight = gridDataInflight.get(memKey);
  if (inflight) return inflight;

  const promise = fetchScanGridData(supabase, scanId, keywordId).then((data) => {
    gridDataInflight.delete(memKey);
    if (data && shouldCacheGridData(data)) {
      gridDataMemory.set(memKey, { data, expiresAt: Date.now() + GRID_DATA_TTL_MS });
    }
    return data;
  });

  gridDataInflight.set(memKey, promise);
  return promise;
}

/** Load grid data, busting cache when a cell id or saved result is missing. */
export async function loadScanGridDataForCell(
  supabase: ServiceClient,
  scanId: string,
  cellId: string,
  keywordId?: string | null
): Promise<{ gridData: ScanGridData; point: ScanPointRow } | null> {
  let gridData = await loadScanGridData(supabase, scanId, keywordId);
  if (!gridData) return null;

  let point = gridData.points.find((p) => p.id === cellId);
  let result = point ? pickScanResultForPoint(gridData.results, cellId) : undefined;

  if (!point || !result) {
    invalidateScanGridCache(scanId);
    gridData = await fetchScanGridData(supabase, scanId, keywordId);
    if (!gridData) return null;
    point = gridData.points.find((p) => p.id === cellId);
    result = point ? pickScanResultForPoint(gridData.results, cellId) : undefined;
    if (point && shouldCacheGridData(gridData)) {
      const memKey = gridDataMemoryKey(scanId, keywordId);
      gridDataMemory.set(memKey, { data: gridData, expiresAt: Date.now() + GRID_DATA_TTL_MS });
    }
  }

  if (!point) return null;
  return { gridData, point };
}
