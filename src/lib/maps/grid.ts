import { categoryMatchesScan, competitorMatchesSearchIntent, isTopPackRank } from "@/lib/maps/category-match";

export interface GridPoint {
  label: string;
  lat: number;
  lng: number;
  row: number;
  col: number;
  distanceFromCenterM: number;
}

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function destinationPoint(lat: number, lng: number, bearingDeg: number, distanceM: number) {
  const lat1 = toRad(lat);
  const lng1 = toRad(lng);
  const brng = toRad(bearingDeg);
  const d = distanceM / EARTH_RADIUS_M;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(brng)
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brng) * Math.sin(d) * Math.cos(lat1),
      Math.cos(d) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: (lat2 * 180) / Math.PI,
    lng: (lng2 * 180) / Math.PI,
  };
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(a));
}

export function generateGrid(params: {
  centerLat: number;
  centerLng: number;
  gridSize: number;
  radiusMeters: number;
}): GridPoint[] {
  const { centerLat, centerLng, gridSize, radiusMeters } = params;
  const points: GridPoint[] = [];
  const half = Math.floor(gridSize / 2);
  const spacing = gridSize > 1 ? (2 * radiusMeters) / (gridSize - 1) : 0;

  for (let row = 0; row < gridSize; row++) {
    for (let col = 0; col < gridSize; col++) {
      const northOffset = (half - row) * spacing;
      const eastOffset = (col - half) * spacing;

      let lat = centerLat;
      let lng = centerLng;

      if (northOffset !== 0) {
        const north = destinationPoint(centerLat, centerLng, 0, Math.abs(northOffset));
        lat = northOffset > 0 ? north.lat : destinationPoint(centerLat, centerLng, 180, Math.abs(northOffset)).lat;
      }
      if (eastOffset !== 0) {
        const moved = destinationPoint(lat, lng, eastOffset > 0 ? 90 : 270, Math.abs(eastOffset));
        lat = moved.lat;
        lng = moved.lng;
      }

      const label = `${String.fromCharCode(65 + row)}${col + 1}`;
      points.push({
        label,
        lat,
        lng,
        row,
        col,
        distanceFromCenterM: haversineM(centerLat, centerLng, lat, lng),
      });
    }
  }

  return points;
}

export interface ScanAggregateMetrics {
  averageRank: number | null;
  top3Cells: number;
  top10Cells: number;
  top20Cells: number;
  notFoundCells: number;
  totalCells: number;
  visibilityScore: number;
}

export function computeAggregateMetrics(
  ranks: Array<number | null>
): ScanAggregateMetrics {
  const totalCells = ranks.length;
  const found = ranks.filter((r): r is number => r != null);
  const averageRank =
    found.length > 0 ? found.reduce((a, b) => a + b, 0) / found.length : null;
  const top3Cells = found.filter((r) => r <= 3).length;
  const top10Cells = found.filter((r) => r <= 10).length;
  const top20Cells = found.filter((r) => r <= 20).length;
  const notFoundCells = ranks.filter((r) => r == null).length;
  const visibilityScore =
    totalCells > 0 ? Math.round((top10Cells / totalCells) * 100) : 0;

  return {
    averageRank: averageRank != null ? Math.round(averageRank * 10) / 10 : null,
    top3Cells,
    top10Cells,
    top20Cells,
    notFoundCells,
    totalCells,
    visibilityScore,
  };
}

export function computeScanTrend(
  current: ScanAggregateMetrics,
  previous: ScanAggregateMetrics | null
): {
  avgRankDelta: number | null;
  visibilityDelta: number | null;
  top10Delta: number | null;
} {
  if (!previous) {
    return { avgRankDelta: null, visibilityDelta: null, top10Delta: null };
  }
  return {
    avgRankDelta:
      current.averageRank != null && previous.averageRank != null
        ? Math.round((previous.averageRank - current.averageRank) * 10) / 10
        : null,
    visibilityDelta: current.visibilityScore - previous.visibilityScore,
    top10Delta: current.top10Cells - previous.top10Cells,
  };
}

export type AggregatedCompetitor = {
  name?: string;
  cid?: string;
  place_id?: string;
  category?: string;
  /** Cells where ranked in positions 1–3 (competitor mode) or all appearances (legacy) */
  appearances: number;
  /** Top-3 pack appearances — primary competitor metric */
  top3Appearances: number;
  totalCells: number;
  /** Avg rank across counted appearances */
  avgRank: number;
  /** Avg rank when in top 3 only */
  avgTop3Rank: number;
  rating?: number;
  review_count?: number;
};

type CompetitorRow = {
  name?: string;
  cid?: string;
  place_id?: string;
  rank?: number;
  rating?: number;
  review_count?: number;
  category?: string;
};

export function aggregateCompetitors(
  results: Array<{ top_competitors_json?: unknown }>,
  options?: {
    excludeCid?: string | null;
    excludePlaceId?: string | null;
    excludeName?: string | null;
    targetCategory?: string | null;
    keyword?: string | null;
    /** Only count ranks 1–3 and filter by category. Default true. */
    top3PackOnly?: boolean;
    categoryFilter?: boolean;
    /** Require keyword/category intent (excludes movers etc. that slip into top 3). */
    intentFilter?: boolean;
    locationTokens?: string[];
    sortBy?: "top3Appearances" | "appearances" | "avgRank";
  }
): AggregatedCompetitor[] {
  const top3PackOnly = options?.top3PackOnly ?? true;
  const categoryFilter = options?.categoryFilter ?? true;
  const intentFilter = options?.intentFilter ?? false;
  const totalCells = results.length;
  const sortBy = options?.sortBy ?? (top3PackOnly ? "top3Appearances" : "appearances");

  const intentParams = {
    targetCategory: options?.targetCategory,
    keyword: options?.keyword,
    locationTokens: options?.locationTokens,
  };

  const map = new Map<
    string,
    {
      name?: string;
      cid?: string;
      place_id?: string;
      category?: string;
      top3Ranks: number[];
      allRanks: number[];
      rating?: number;
      review_count?: number;
    }
  >();

  for (const result of results) {
    const competitors = (result.top_competitors_json ?? []) as CompetitorRow[];
    for (const c of competitors) {
      if (options?.excludeCid && c.cid === options.excludeCid) continue;
      if (options?.excludePlaceId && c.place_id === options.excludePlaceId) continue;
      if (
        options?.excludeName &&
        c.name?.trim().toLowerCase() === options.excludeName.trim().toLowerCase()
      ) {
        continue;
      }

      if (intentFilter) {
        if (!competitorMatchesSearchIntent(c.name, c.category, intentParams)) continue;
      } else if (categoryFilter) {
        const matches = categoryMatchesScan(c.category, {
          targetCategory: options?.targetCategory,
          keyword: options?.keyword,
        });
        if (!matches) continue;
      }

      if (top3PackOnly && !isTopPackRank(c.rank)) continue;

      const key = c.place_id ?? c.cid ?? c.name ?? "unknown";
      const existing = map.get(key) ?? {
        name: c.name,
        cid: c.cid,
        place_id: c.place_id,
        category: c.category,
        top3Ranks: [],
        allRanks: [],
      };
      if (c.rank) {
        existing.allRanks.push(c.rank);
        if (isTopPackRank(c.rank)) existing.top3Ranks.push(c.rank);
      }
      if (c.category && !existing.category) existing.category = c.category;
      if (c.place_id && !existing.place_id) existing.place_id = c.place_id;
      if (c.rating != null && (existing.rating == null || c.rating > existing.rating)) {
        existing.rating = c.rating;
      }
      if (
        c.review_count != null &&
        (existing.review_count == null || c.review_count > existing.review_count)
      ) {
        existing.review_count = c.review_count;
      }
      map.set(key, existing);
    }
  }

  return Array.from(map.values())
    .map((v) => {
      const ranks = top3PackOnly ? v.top3Ranks : v.allRanks;
      const avgRank = ranks.length
        ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10
        : 0;
      const avgTop3Rank = v.top3Ranks.length
        ? Math.round((v.top3Ranks.reduce((a, b) => a + b, 0) / v.top3Ranks.length) * 10) / 10
        : 0;
      return {
        name: v.name,
        cid: v.cid,
        place_id: v.place_id,
        category: v.category,
        appearances: ranks.length,
        top3Appearances: v.top3Ranks.length,
        totalCells,
        avgRank,
        avgTop3Rank,
        rating: v.rating,
        review_count: v.review_count,
      };
    })
    .filter((c) => c.top3Appearances > 0 || (!top3PackOnly && c.appearances > 0))
    .sort((a, b) => {
      if (sortBy === "top3Appearances") {
        return b.top3Appearances - a.top3Appearances || a.avgTop3Rank - b.avgTop3Rank;
      }
      if (sortBy === "avgRank") {
        return a.avgRank - b.avgRank || b.top3Appearances - a.top3Appearances;
      }
      return b.appearances - a.appearances || a.avgRank - b.avgRank;
    });
}

/** Dedupe by place_id / cid / name while preserving first-seen rank order. */
export function mergeCompetitorCandidatePools(
  ...pools: AggregatedCompetitor[][]
): AggregatedCompetitor[] {
  const seen = new Set<string>();
  const merged: AggregatedCompetitor[] = [];
  for (const pool of pools) {
    for (const c of pool) {
      const key = c.place_id ?? c.cid ?? c.name ?? "";
      if (!key || seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
    }
  }
  return merged;
}

export type CompetitorPoolTier = "center_pack" | "grid_pack";

type ScanResultRow = { top_competitors_json?: unknown; scan_point_id?: string; keyword_id?: string };

/** Results from the grid cell closest to the business (simulates search from that exact point). */
export function filterScanResultsToCenterCell(
  results: ScanResultRow[],
  points: Array<{ id: string; distance_from_center_m?: number | null }>,
  primaryKeywordId?: string | null
): ScanResultRow[] {
  if (!points.length) return results;
  const sorted = [...points].sort(
    (a, b) => (a.distance_from_center_m ?? 0) - (b.distance_from_center_m ?? 0)
  );
  const centerPointId = sorted[0]?.id;
  if (!centerPointId) return results;
  return results.filter(
    (r) =>
      r.scan_point_id === centerPointId &&
      (!primaryKeywordId || r.keyword_id === primaryKeywordId)
  );
}

/**
 * Ranked competitor pool for Review Momentum.
 * Each grid scan cell uses DataForSEO location_coordinate at that cell's lat/lng.
 * Pool priority: center cell SERP first (matches "search from here"), then full grid — always intent-filtered.
 */
export function buildReviewMomentumCompetitorPool(
  results: ScanResultRow[],
  options: {
    excludeCid?: string | null;
    excludePlaceId?: string | null;
    excludeName?: string | null;
    targetCategory?: string | null;
    keyword?: string | null;
    locationTokens?: string[];
    scanPoints?: Array<{ id: string; distance_from_center_m?: number | null }>;
    primaryKeywordId?: string | null;
  }
): Array<AggregatedCompetitor & { poolTier: CompetitorPoolTier }> {
  const base = {
    excludeCid: options.excludeCid,
    excludePlaceId: options.excludePlaceId,
    excludeName: options.excludeName,
    targetCategory: options.targetCategory,
    keyword: options.keyword,
    locationTokens: options.locationTokens,
    top3PackOnly: true as const,
    intentFilter: true as const,
    sortBy: "top3Appearances" as const,
  };

  const centerResults = filterScanResultsToCenterCell(
    results,
    options.scanPoints ?? [],
    options.primaryKeywordId
  );

  const tierCenter = aggregateCompetitors(centerResults, base).map((c) => ({
    ...c,
    poolTier: "center_pack" as const,
  }));
  const tierGrid = aggregateCompetitors(results, base).map((c) => ({
    ...c,
    poolTier: "grid_pack" as const,
  }));

  const merged = mergeCompetitorCandidatePools(tierCenter, tierGrid);
  const tierByKey = new Map<string, CompetitorPoolTier>();
  for (const c of [...tierCenter, ...tierGrid]) {
    const key = c.place_id ?? c.cid ?? c.name ?? "";
    if (key && !tierByKey.has(key)) tierByKey.set(key, c.poolTier);
  }

  return merged.map((c) => ({
    ...c,
    poolTier: tierByKey.get(c.place_id ?? c.cid ?? c.name ?? "") ?? "grid_pack",
  }));
}

/** Top-3 map pack competitors for Rank Grid — same intent rules as Review Momentum. */
export function buildGridTopCompetitors(
  results: Array<{ top_competitors_json?: unknown }>,
  options: {
    excludeCid?: string | null;
    excludePlaceId?: string | null;
    excludeName?: string | null;
    targetCategory?: string | null;
    keyword?: string | null;
    locationTokens?: string[];
    limit?: number;
  }
): AggregatedCompetitor[] {
  return aggregateCompetitors(results, {
    excludeCid: options.excludeCid,
    excludePlaceId: options.excludePlaceId,
    excludeName: options.excludeName,
    targetCategory: options.targetCategory,
    keyword: options.keyword,
    locationTokens: options.locationTokens,
    top3PackOnly: true,
    intentFilter: true,
    categoryFilter: false,
    sortBy: "top3Appearances",
  }).slice(0, options.limit ?? 5);
}
