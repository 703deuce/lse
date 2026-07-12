import {
  matchTargetInResults,
  type TargetMatchInput,
} from "@/lib/providers/dataforseo/match-target";
import type { MapsLiveResult } from "@/lib/providers/dataforseo";
import {
  computeAggregateMetrics,
  type ScanAggregateMetrics,
} from "@/lib/maps/grid";
import { computeSolv } from "@/lib/maps/grid-metrics";
import { dedupeScanResults } from "@/lib/maps/cell-result-integrity";

export type StoredCompetitor = {
  rank?: number;
  name?: string;
  cid?: string;
  place_id?: string;
  rating?: number;
  review_count?: number;
  category?: string;
  address?: string;
  phone?: string;
  url?: string;
  lat?: number;
  lng?: number;
};

export type GridEntityRef = {
  key: string;
  label: string;
  cid?: string | null;
  place_id?: string | null;
  name?: string | null;
  phone?: string | null;
  website_url?: string | null;
  isTarget?: boolean;
};

export type GridCellView = {
  pointId: string;
  label: string;
  lat: number;
  lng: number;
  row: number;
  col: number;
  rank: number | null;
  pending?: boolean;
  failed?: boolean;
  notInResults?: boolean;
  matchReason?: string | null;
};

export type EntityMatchResult = {
  rank: number | null;
  found: boolean;
  matchReason: string | null;
  matched?: StoredCompetitor;
};

export type CellComparison = {
  label: string;
  row: number;
  col: number;
  lat: number;
  lng: number;
  rankA: number | null;
  rankB: number | null;
  delta: number | null;
  direction: "improved" | "declined" | "unchanged" | "missing";
};

export type CompareSummary = {
  avgRankA: number | null;
  avgRankB: number | null;
  avgRankDelta: number | null;
  solvA: number;
  solvB: number;
  solvDelta: number;
  top3CellsA: number;
  top3CellsB: number;
  top3Delta: number;
  improvedCells: number;
  declinedCells: number;
  unchangedCells: number;
  missingCells: number;
};

export function parseGridLabel(label: string): { row: number; col: number } {
  const match = /^([A-Z])(\d+)$/i.exec(label.trim());
  if (!match) return { row: 0, col: 0 };
  return {
    row: match[1].toUpperCase().charCodeAt(0) - 65,
    col: Number(match[2]) - 1,
  };
}

export function normalizeRankForCalc(rank: number | null | undefined): number {
  if (rank == null || rank > 20) return 21;
  return rank;
}

export function rankDelta(oldRank: number | null, newRank: number | null): number | null {
  const a = normalizeRankForCalc(oldRank);
  const b = normalizeRankForCalc(newRank);
  if (oldRank == null && newRank == null) return null;
  return a - b;
}

/** Positive = you rank better (lower number) than competitor at this cell */
export function rankDeltaHeadToHead(
  yourRank: number | null,
  theirRank: number | null
): number | null {
  const y = normalizeRankForCalc(yourRank);
  const t = normalizeRankForCalc(theirRank);
  if (yourRank == null && theirRank == null) return null;
  return t - y;
}

export function deltaDirection(delta: number | null): CellComparison["direction"] {
  if (delta == null) return "missing";
  if (delta > 0) return "improved";
  if (delta < 0) return "declined";
  return "unchanged";
}

export function entityFromKey(key: string, label: string): GridEntityRef {
  if (key === "you") {
    return { key, label, isTarget: true, name: label };
  }
  if (key.startsWith("cid:")) {
    const cid = key.slice(4);
    return { key, label, isTarget: false, cid, name: label };
  }
  if (key.startsWith("place:")) {
    const place_id = key.slice(6);
    return { key, label, isTarget: false, place_id, name: label };
  }
  if (key.startsWith("name:")) {
    return { key, label, isTarget: false, name: label };
  }
  return { key, label, isTarget: false, name: label };
}

export function entityKeyFromParts(parts: {
  cid?: string | null;
  place_id?: string | null;
  name?: string | null;
}): string {
  if (parts.cid) return `cid:${parts.cid}`;
  if (parts.place_id) return `place:${parts.place_id}`;
  if (parts.name) return `name:${parts.name.trim().toLowerCase()}`;
  return "unknown";
}

export function buildYouEntity(business: {
  name?: string | null;
  cid?: string | null;
  place_id?: string | null;
  phone?: string | null;
  website_url?: string | null;
}): GridEntityRef {
  return {
    key: "you",
    label: business.name?.trim() || "Your business",
    cid: business.cid,
    place_id: business.place_id,
    name: business.name,
    phone: business.phone,
    website_url: business.website_url,
    isTarget: true,
  };
}

export function entityToMatchInput(entity: GridEntityRef): TargetMatchInput {
  return {
    cid: entity.cid,
    place_id: entity.place_id,
    name: entity.name,
    phone: entity.phone,
    website_url: entity.website_url,
  };
}

function competitorsToMapsItems(competitors: StoredCompetitor[]): MapsLiveResult[] {
  return competitors.map((c, i) => ({
    title: c.name,
    cid: c.cid,
    place_id: c.place_id,
    phone: c.phone,
    url: c.url,
    address: c.address,
    rank_group: c.rank ?? i + 1,
  })) as MapsLiveResult[];
}

export function findEntityInCompetitors(
  competitors: StoredCompetitor[],
  entity: GridEntityRef
): EntityMatchResult {
  if (!competitors.length) {
    return { rank: null, found: false, matchReason: null };
  }
  const items = competitorsToMapsItems(competitors);
  const match = matchTargetInResults(items, entityToMatchInput(entity), competitors.length);
  const matched = match.item
    ? competitors.find(
        (c, i) =>
          (c.cid && c.cid === match.item?.cid) ||
          (c.place_id && c.place_id === match.item?.place_id) ||
          (c.name && c.name === match.item?.title) ||
          i === items.indexOf(match.item!)
      )
    : undefined;
  return {
    rank: match.rank,
    found: match.found,
    matchReason: match.matchReason,
    matched,
  };
}

type ScanPointRow = {
  id: string;
  grid_label: string;
  lat: number;
  lng: number;
};

type ScanResultRow = {
  scan_point_id: string;
  keyword_id?: string;
  created_at?: string;
  target_rank?: number | null;
  target_found?: boolean;
  confidence?: string | null;
  top_competitors_json?: unknown;
};

export function filterResultsByKeyword(
  results: ScanResultRow[],
  keywordId: string | null | undefined
): ScanResultRow[] {
  if (!keywordId) return results;
  return results.filter((r) => (r as { keyword_id?: string }).keyword_id === keywordId);
}

export function buildEntityGridCells(
  points: ScanPointRow[],
  results: ScanResultRow[],
  entity: GridEntityRef,
  options?: { scanActive?: boolean; failedPointIds?: Set<string> }
): GridCellView[] {
  const deduped = dedupeScanResults(results);
  const resultByPoint = new Map(deduped.map((r) => [r.scan_point_id, r]));
  const useTargetRank = entity.isTarget;

  return points.map((p) => {
    const { row, col } = parseGridLabel(p.grid_label);
    const result = resultByPoint.get(p.id);
    const hasResult = result != null;
    // Never show ✕ — cells retry in the background; show pending until a result lands.
    const failed = false;
    let rank: number | null = null;
    let matchReason: string | null = null;
    let notInResults = false;

    if (hasResult) {
      if (useTargetRank) {
        rank = (result?.target_rank as number | null) ?? null;
        matchReason = (result?.confidence as string | null) ?? null;
        notInResults = rank == null;
      } else {
        const competitors = (result?.top_competitors_json ?? []) as StoredCompetitor[];
        const match = findEntityInCompetitors(competitors, entity);
        rank = match.rank;
        matchReason = match.matchReason;
        notInResults = !match.found || rank == null;
      }
    }

    return {
      pointId: p.id,
      label: p.grid_label,
      lat: p.lat,
      lng: p.lng,
      row,
      col,
      rank,
      pending: !hasResult && (options?.scanActive !== false),
      failed,
      notInResults: hasResult && notInResults,
      matchReason,
    };
  });
}

export function metricsFromCells(cells: GridCellView[]): ScanAggregateMetrics {
  const settled = cells.filter((c) => !c.pending);
  const ranks = settled.map((c) => (c.notInResults || c.failed ? null : c.rank));
  return computeAggregateMetrics(ranks);
}

export function solvFromCells(cells: GridCellView[]): number {
  const metrics = metricsFromCells(cells);
  return computeSolv(metrics.top3Cells, metrics.totalCells);
}

export function compareEntityGrids(
  pointsA: ScanPointRow[],
  resultsA: ScanResultRow[],
  pointsB: ScanPointRow[],
  resultsB: ScanResultRow[],
  entityA: GridEntityRef,
  entityB: GridEntityRef = entityA,
  options?: { headToHead?: boolean }
): { cells: CellComparison[]; summary: CompareSummary } {
  const cellsA = buildEntityGridCells(pointsA, resultsA, entityA);
  const cellsB = buildEntityGridCells(pointsB, resultsB, entityB);
  const mapB = new Map(cellsB.map((c) => [c.label, c]));
  const headToHead = options?.headToHead ?? false;

  const comparisons: CellComparison[] = cellsA.map((a) => {
    const b = mapB.get(a.label);
    const rankA = a.notInResults ? null : a.rank;
    const rankB = b ? (b.notInResults ? null : b.rank) : null;
    const delta = headToHead
      ? rankDeltaHeadToHead(rankA, rankB)
      : rankDelta(rankA, rankB);
    return {
      label: a.label,
      row: a.row,
      col: a.col,
      lat: a.lat,
      lng: a.lng,
      rankA,
      rankB,
      delta,
      direction: deltaDirection(delta),
    };
  });

  const metricsA = metricsFromCells(cellsA);
  const metricsB = metricsFromCells(cellsB);
  const solvA = computeSolv(metricsA.top3Cells, metricsA.totalCells);
  const solvB = computeSolv(metricsB.top3Cells, metricsB.totalCells);

  let improved = 0;
  let declined = 0;
  let unchanged = 0;
  let missing = 0;
  for (const c of comparisons) {
    if (c.direction === "improved") improved++;
    else if (c.direction === "declined") declined++;
    else if (c.direction === "unchanged") unchanged++;
    else missing++;
  }

  const avgA = metricsA.averageRank;
  const avgB = metricsB.averageRank;

  return {
    cells: comparisons,
    summary: {
      avgRankA: avgA,
      avgRankB: avgB,
      avgRankDelta:
        avgA != null && avgB != null ? Math.round((avgA - avgB) * 10) / 10 : null,
      solvA,
      solvB,
      solvDelta: Math.round((solvA - solvB) * 100) / 100,
      top3CellsA: metricsA.top3Cells,
      top3CellsB: metricsB.top3Cells,
      top3Delta: metricsA.top3Cells - metricsB.top3Cells,
      improvedCells: improved,
      declinedCells: declined,
      unchangedCells: unchanged,
      missingCells: missing,
    },
  };
}

export function entitiesFromTopCompetitors(
  competitors: Array<{
    name?: string;
    cid?: string;
    place_id?: string;
  }>,
  limit = 5
): GridEntityRef[] {
  return competitors.slice(0, limit).map((c) => ({
    key: entityKeyFromParts(c),
    label: c.name?.trim() || "Competitor",
    cid: c.cid,
    place_id: c.place_id,
    name: c.name,
    isTarget: false,
  }));
}
