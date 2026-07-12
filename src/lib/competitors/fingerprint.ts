import type { StoredCompetitor } from "@/lib/maps/grid-entity";
import {
  buildEntityGridCells,
  entityKeyFromParts,
  findEntityInCompetitors,
  metricsFromCells,
  solvFromCells,
  type GridEntityRef,
} from "@/lib/maps/grid-entity";
import { haversineMiles } from "@/lib/maps/distance";
import type { ScanPointRow, ScanResultRow } from "@/lib/db/types";

export type StrengthScores = {
  reviews: number | null;
  velocity: number | null;
  proximity: number | null;
  gbpRelevance: number | null;
  website: number | null;
  authority: number | null;
};

export type FingerprintEvidence = {
  reviewCount?: number | null;
  rating?: number | null;
  reviewsLast30Days?: number | null;
  daysSinceLastReview?: number | null;
  primaryCategory?: string | null;
  secondaryCategories?: string[];
  services?: string[];
  websiteTitle?: string | null;
  citationCount?: number | null;
  referringDomains?: number | null;
  localTrustMentions?: number | null;
};

export type CompetitorFingerprint = {
  competitor: {
    id: string | null;
    entityKey: string;
    name: string;
    website?: string | null;
    category?: string | null;
    rating?: number | null;
    reviewCount?: number | null;
    isTracked: boolean;
    limitedData: boolean;
  };
  mapStats: {
    avgRank: number | null;
    top3Cells: number;
    totalCells: number;
    solv: number;
    strongestArea?: string | null;
    weakestArea?: string | null;
  };
  strengthScores: StrengthScores;
  badges: string[];
  evidence: FingerprintEvidence;
  dataFreshness: Record<string, string | null>;
};

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function scoreReviews(count?: number | null, rating?: number | null): number | null {
  if (count == null) return null;
  const volume = Math.min(100, (count / 200) * 100);
  const quality = rating != null ? (rating / 5) * 100 : 50;
  return clampScore(volume * 0.7 + quality * 0.3);
}

function scoreVelocity(last30?: number | null): number | null {
  if (last30 == null) return null;
  return clampScore(Math.min(100, last30 * 8));
}

function computeMapStats(
  points: ScanPointRow[],
  results: ScanResultRow[],
  entity: GridEntityRef,
  centerLat: number,
  centerLng: number
) {
  const cells = buildEntityGridCells(points, results, entity);
  const metrics = metricsFromCells(cells);
  const solv = solvFromCells(cells);

  let strongest: { label: string; rank: number } | null = null;
  let weakest: { label: string; rank: number } | null = null;

  for (const c of cells) {
    if (c.notInResults || c.rank == null) continue;
    if (!strongest || c.rank < strongest.rank) strongest = { label: c.label, rank: c.rank };
    if (!weakest || c.rank > weakest.rank) weakest = { label: c.label, rank: c.rank };
  }

  const avgDist =
    cells.length > 0
      ? cells.reduce((s, c) => s + haversineMiles(centerLat, centerLng, c.lat, c.lng), 0) / cells.length
      : null;

  return {
    avgRank: metrics.averageRank,
    top3Cells: metrics.top3Cells,
    totalCells: metrics.totalCells,
    solv,
    strongestArea: strongest ? `${strongest.label} (#${strongest.rank})` : null,
    weakestArea: weakest ? `${weakest.label} (#${weakest.rank})` : null,
    avgDistMiles: avgDist != null ? Math.round(avgDist * 10) / 10 : null,
  };
}

export function buildCompetitorFingerprint(params: {
  entity: GridEntityRef;
  raw?: StoredCompetitor | null;
  competitorId?: string | null;
  points?: ScanPointRow[];
  results?: ScanResultRow[];
  centerLat?: number;
  centerLng?: number;
  keyword?: string | null;
  momentum?: { reviewsLast30Days?: number | null; daysSinceLastReview?: number | null; momentumScore?: number | null } | null;
  snapshot?: {
    category?: string | null;
    additional_categories?: string[] | null;
    rating?: number | null;
    review_count?: number | null;
    services_json?: Record<string, unknown> | null;
  } | null;
  citations?: { count?: number | null } | null;
  backlinks?: { referringDomains?: number | null } | null;
  localTrust?: { mentionCount?: number | null } | null;
  website?: { title?: string | null; hasServicePage?: boolean } | null;
}): CompetitorFingerprint {
  const raw = params.raw;
  const name = params.entity.label || raw?.name || "Competitor";
  const reviewCount = params.snapshot?.review_count ?? raw?.review_count ?? null;
  const rating = params.snapshot?.rating ?? raw?.rating ?? null;
  const category = params.snapshot?.category ?? raw?.category ?? null;
  const entityKey = params.entity.key || entityKeyFromParts(params.entity);

  let mapStats = {
    avgRank: null as number | null,
    top3Cells: 0,
    totalCells: 0,
    solv: 0,
    strongestArea: null as string | null,
    weakestArea: null as string | null,
    avgDistMiles: null as number | null,
  };

  if (params.points && params.results && params.centerLat != null && params.centerLng != null) {
    const stats = computeMapStats(params.points, params.results, params.entity, params.centerLat, params.centerLng);
    mapStats = stats;
  }

  const proximityScore =
    mapStats.avgDistMiles != null ? clampScore(100 - mapStats.avgDistMiles * 15) : null;

  const strengthScores: StrengthScores = {
    reviews: scoreReviews(reviewCount, rating),
    velocity: params.momentum?.momentumScore ?? scoreVelocity(params.momentum?.reviewsLast30Days),
    proximity: proximityScore,
    gbpRelevance: category ? clampScore(60 + (params.snapshot?.additional_categories?.length ?? 0) * 8) : null,
    website: params.website?.hasServicePage ? 75 : params.website?.title ? 50 : null,
    authority: clampScore(
      (params.citations?.count ?? 0) * 3 + (params.backlinks?.referringDomains ?? 0) * 2 + (params.localTrust?.mentionCount ?? 0) * 5
    ) || null,
  };

  const badges: string[] = [];
  if ((strengthScores.reviews ?? 0) >= 70) badges.push("Strong reviews");
  if ((strengthScores.velocity ?? 0) >= 60) badges.push("High velocity");
  if ((strengthScores.proximity ?? 0) >= 65) badges.push("Close to search center");
  if (category && params.keyword && category.toLowerCase().includes(params.keyword.split(" ")[0] ?? "")) {
    badges.push("Category match");
  }
  if (params.website?.hasServicePage) badges.push("Has matching service page");
  if ((params.citations?.count ?? 0) > 0) badges.push("Local citations found");

  const services = params.snapshot?.services_json
    ? Object.keys(params.snapshot.services_json).slice(0, 8)
    : [];

  return {
    competitor: {
      id: params.competitorId ?? null,
      entityKey,
      name,
      website: raw?.url ?? params.entity.website_url,
      category,
      rating,
      reviewCount,
      isTracked: !!params.competitorId,
      limitedData: !params.competitorId && !raw,
    },
    mapStats: {
      avgRank: mapStats.avgRank,
      top3Cells: mapStats.top3Cells,
      totalCells: mapStats.totalCells,
      solv: mapStats.solv,
      strongestArea: mapStats.strongestArea,
      weakestArea: mapStats.weakestArea,
    },
    strengthScores,
    badges,
    evidence: {
      reviewCount,
      rating,
      reviewsLast30Days: params.momentum?.reviewsLast30Days,
      daysSinceLastReview: params.momentum?.daysSinceLastReview,
      primaryCategory: category,
      secondaryCategories: params.snapshot?.additional_categories ?? [],
      services,
      websiteTitle: params.website?.title,
      citationCount: params.citations?.count,
      referringDomains: params.backlinks?.referringDomains,
      localTrustMentions: params.localTrust?.mentionCount,
    },
    dataFreshness: {
      scan: null,
      momentum: params.momentum ? "cached" : null,
      citations: params.citations ? "cached" : null,
      backlinks: params.backlinks ? "cached" : null,
    },
  };
}

export function entityFromRawResult(raw: StoredCompetitor, label?: string): GridEntityRef {
  return {
    key: entityKeyFromParts(raw),
    label: label ?? raw.name ?? "Competitor",
    cid: raw.cid,
    place_id: raw.place_id,
    name: raw.name,
    phone: raw.phone,
    website_url: raw.url,
    isTarget: false,
  };
}

export function findRawInResults(results: ScanResultRow[], entity: GridEntityRef): StoredCompetitor | null {
  for (const result of results) {
    const competitors = (result.top_competitors_json ?? []) as StoredCompetitor[];
    const match = findEntityInCompetitors(competitors, entity);
    if (match.found && match.matched) return match.matched;
  }
  return null;
}
