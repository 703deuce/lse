import type { MapsLiveResult } from "@/lib/providers/dataforseo";
import {
  matchTargetInResults,
  type TargetMatchInput,
} from "@/lib/providers/dataforseo/match-target";

export type CellSerpValidation = {
  complete: boolean;
  reason?: string;
  /** Normalized provider/SERP failure category when incomplete. */
  category?: "empty_maps_results" | "sparse_maps_results";
};

/**
 * Minimum organics required for any accepted cell (found or not).
 * We still *request* depth (usually 20), but some Maps packs legitimately
 * return 10–19 listings — treat those as complete. Below this floor, retry.
 * Override with GRID_CELL_MIN_SERP_RESULTS (capped at depth).
 */
export const DEFAULT_MIN_CELL_SERP_RESULTS = 10;

export function minCellSerpResults(depth = 20): number {
  const env = Number(process.env.GRID_CELL_MIN_SERP_RESULTS);
  const floor = Number.isFinite(env) && env > 0 ? Math.floor(env) : DEFAULT_MIN_CELL_SERP_RESULTS;
  return Math.max(1, Math.min(floor, depth));
}

/**
 * Minimum organics required before we may claim "not in pack" / 20+.
 * Same floor as found cells — a very short SERP is not proof of 20+.
 * Override with GRID_CELL_NOT_FOUND_MIN_SERP_RESULTS (capped at depth).
 */
export function minResultsForNotFound(depth = 20): number {
  const env = Number(process.env.GRID_CELL_NOT_FOUND_MIN_SERP_RESULTS);
  const floor = Number.isFinite(env) && env > 0 ? Math.floor(env) : DEFAULT_MIN_CELL_SERP_RESULTS;
  return Math.max(1, Math.min(floor, depth));
}

function competitorCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

export function validateLiveCellSerp(
  items: MapsLiveResult[],
  target: TargetMatchInput,
  depth = 20
): CellSerpValidation {
  if (!items.length) {
    return {
      complete: false,
      reason: "Bright Data returned no map results for this cell",
      category: "empty_maps_results",
    };
  }

  const match = matchTargetInResults(items, target, items.length);

  if (match.found) {
    const minFound = minCellSerpResults(depth);
    if (items.length < minFound) {
      return {
        complete: false,
        reason:
          items.length === 1
            ? `target-only SERP: only your listing returned (need ${minFound})`
            : `sparse SERP: ${items.length} results returned (need ${minFound})`,
        category: "sparse_maps_results",
      };
    }
    return { complete: true };
  }

  // Not found — only complete (true 20+) when the full top-N pack came back.
  const need = minResultsForNotFound(depth);
  if (items.length < need) {
    return {
      complete: false,
      reason: `incomplete SERP for 20+: ${items.length} results (need ${need} before ranking as not found)`,
      category: "sparse_maps_results",
    };
  }
  return { complete: true };
}

export function validateStoredCellResult(
  row:
    | {
        target_found?: boolean | null;
        target_rank?: number | null;
        /** Accept unknown from Supabase selects — only array length is inspected. */
        top_competitors_json?: unknown;
      }
    | null
    | undefined,
  depth = 20
): CellSerpValidation {
  if (!row) {
    return { complete: false, reason: "no saved cell result" };
  }
  const count = competitorCount(row.top_competitors_json);
  const found = row.target_found === true || (row.target_rank != null && Number(row.target_rank) > 0);

  if (found) {
    const min = minCellSerpResults(depth);
    if (count < min) {
      if (count <= 1) {
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

  // Saved as not-found / 20+ — require a full pack or treat as incomplete for recovery.
  const need = minResultsForNotFound(depth);
  if (count < need) {
    return {
      complete: false,
      reason: `incomplete stored SERP for 20+: ${count} results (need ${need})`,
    };
  }
  return { complete: true };
}

export function isRetryableCellSerpError(message: string): boolean {
  const msg = message.toLowerCase();
  return (
    msg.includes("sparse serp") ||
    msg.includes("target-only serp") ||
    msg.includes("incomplete serp for 20+") ||
    msg.includes("incomplete stored serp for 20+") ||
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
  return (
    competitors * 1000 +
    rankBonus +
    (Number.isFinite(createdAt) ? createdAt / 1_000_000_000 : 0)
  );
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
