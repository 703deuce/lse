import type { MapsLiveResult } from "@/lib/providers/dataforseo";
import {
  matchTargetInResults,
  type TargetMatchInput,
} from "@/lib/providers/dataforseo/match-target";
import type { ScanResultRow } from "@/lib/db/types";

export type CellSerpValidation = {
  complete: boolean;
  reason?: string;
  /** Normalized provider/SERP failure category when incomplete. */
  category?: "empty_maps_results" | "sparse_maps_results";
};

export function minCellSerpResults(depth = 20): number {
  const env = Number(process.env.GRID_CELL_MIN_SERP_RESULTS);
  if (Number.isFinite(env) && env > 0) return Math.min(env, depth);
  return Math.min(3, depth);
}

function competitorCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function validateLiveCellSerp(
  items: MapsLiveResult[],
  target: TargetMatchInput,
  depth = 20
): CellSerpValidation {
  const min = minCellSerpResults(depth);
  if (!items.length) {
    return {
      complete: false,
      reason: "Bright Data returned no map results for this cell",
      category: "empty_maps_results",
    };
  }
  if (items.length < min) {
    const targetOnly =
      items.length === 1 &&
      matchTargetInResults(items, target, items.length).found;
    return {
      complete: false,
      reason: targetOnly
        ? `target-only SERP: only your listing returned (need ${min})`
        : `sparse SERP: ${items.length} results returned (need ${min})`,
      category: "sparse_maps_results",
    };
  }
  return { complete: true };
}

export function validateStoredCellResult(
  row: Pick<ScanResultRow, "target_found" | "top_competitors_json"> | null | undefined,
  depth = 20
): CellSerpValidation {
  if (!row) {
    return { complete: false, reason: "no saved cell result" };
  }
  const count = competitorCount(row.top_competitors_json);
  const min = minCellSerpResults(depth);
  if (count < min) {
    if (row.target_found && count <= 1) {
      return {
        complete: false,
        reason: `target-only SERP: only your listing stored (need ${min})`,
      };
    }
    return {
      complete: false,
      reason: `sparse stored SERP: ${count} results saved (need ${min})`,
    };
  }
  return { complete: true };
}

export function isRetryableCellSerpError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("sparse serp") ||
    msg.includes("target-only serp") ||
    msg.includes("no map results") ||
    msg.includes("no saved cell result")
  );
}

export type StoredScanResultRow = {
  scan_point_id: string;
  keyword_id?: string;
  created_at?: string;
  target_rank?: number | null;
  target_found?: boolean;
  confidence?: string | null;
  top_competitors_json?: unknown;
};

function resultQualityScore(row: StoredScanResultRow): number {
  const competitors = competitorCount(row.top_competitors_json);
  const rankBonus = row.target_found ? 10 : 0;
  const createdAt = row.created_at ? Date.parse(row.created_at) : 0;
  return competitors * 1000 + rankBonus + (Number.isFinite(createdAt) ? createdAt / 1_000_000_000 : 0);
}

/** When duplicate rows exist for a point+keyword, keep the richest result. */
export function dedupeScanResults<T extends StoredScanResultRow>(results: T[]): T[] {
  const byKey = new Map<string, T>();
  for (const row of results) {
    const keywordId = row.keyword_id ?? "";
    const key = `${row.scan_point_id}:${keywordId}`;
    const prev = byKey.get(key);
    if (!prev || resultQualityScore(row) > resultQualityScore(prev)) {
      byKey.set(key, row);
    }
  }
  return [...byKey.values()];
}

export function pickScanResultForPoint<T extends StoredScanResultRow>(
  results: T[],
  scanPointId: string
): T | undefined {
  return dedupeScanResults(results).find((r) => r.scan_point_id === scanPointId);
}
