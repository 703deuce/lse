/**
 * SERP consensus for sparse DataForSEO Maps packs.
 *
 * Preferred pack size is still 20, but Google can legitimately return fewer.
 * Low packs (0–9) are retried until the same place_id pattern appears N times.
 */

import type { MapsLiveResult } from "@/lib/providers/dataforseo";

/** Preferred full pack — accept immediately when met. */
export const DESIRED_SERP_COUNT = 20;

/**
 * Soft floor: 10–19 accepted without consensus (unless empty / target-only).
 * Below this, require consensus of identical sparse SERPs.
 */
export const SOFT_ACCEPT_MIN_SERP = 10;

/** How many matching sparse observations before we accept a low pack. */
export const SERP_CONSENSUS_REQUIRED = 3;

/** Place-id Jaccard / overlap threshold for “same SERP”. */
export const SERP_LISTING_OVERLAP_MIN = 0.8;

/** When this many cells remain unfinished, use Live instead of Priority. */
export const DFS_LIVE_TAIL_THRESHOLD = 5;

export type SerpObservation = {
  count: number;
  placeIds: string[];
  items: MapsLiveResult[];
};

export type SerpAcceptDecision =
  | { action: "accept"; reason: "full_pack" | "soft_pack" }
  | { action: "retry"; reason: "empty" | "sparse_needs_consensus" | "target_only" };

function listingId(item: MapsLiveResult): string | null {
  const place = typeof item.place_id === "string" ? item.place_id.trim() : "";
  if (place) return `p:${place}`;
  const cid = typeof item.cid === "string" ? item.cid.trim() : "";
  if (cid) return `c:${cid}`;
  return null;
}

export function fingerprintSerp(items: MapsLiveResult[]): SerpObservation {
  const placeIds: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const id = listingId(item);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    placeIds.push(id);
  }
  return { count: items.length, placeIds, items };
}

/** Intersection / max(|A|,|B|) — 1.0 when identical sets. */
export function listingOverlap(a: SerpObservation, b: SerpObservation): number {
  if (!a.placeIds.length && !b.placeIds.length) {
    return a.count === 0 && b.count === 0 ? 1 : 0;
  }
  const setB = new Set(b.placeIds);
  let inter = 0;
  for (const id of a.placeIds) {
    if (setB.has(id)) inter += 1;
  }
  const denom = Math.max(a.placeIds.length, b.placeIds.length, 1);
  return inter / denom;
}

/**
 * Rank-order similarity over shared place ids (Spearman-like on positions).
 * Returns 1 when shared listings appear in the same relative order.
 */
export function rankOrderSimilarity(a: SerpObservation, b: SerpObservation): number {
  const posA = new Map(a.placeIds.map((id, i) => [id, i] as const));
  const posB = new Map(b.placeIds.map((id, i) => [id, i] as const));
  const shared = a.placeIds.filter((id) => posB.has(id));
  if (shared.length <= 1) return shared.length === 1 ? 1 : 0;

  let agree = 0;
  let pairs = 0;
  for (let i = 0; i < shared.length; i++) {
    for (let j = i + 1; j < shared.length; j++) {
      const idI = shared[i]!;
      const idJ = shared[j]!;
      const aOrder = (posA.get(idI) ?? 0) - (posA.get(idJ) ?? 0);
      const bOrder = (posB.get(idI) ?? 0) - (posB.get(idJ) ?? 0);
      pairs += 1;
      if ((aOrder >= 0 && bOrder >= 0) || (aOrder <= 0 && bOrder <= 0)) agree += 1;
    }
  }
  return pairs === 0 ? 0 : agree / pairs;
}

export function observationsAreConsistent(
  a: SerpObservation,
  b: SerpObservation,
  opts?: { overlapMin?: number; requireExactCount?: boolean }
): boolean {
  const overlapMin = opts?.overlapMin ?? SERP_LISTING_OVERLAP_MIN;
  const requireExactCount = opts?.requireExactCount ?? true;
  if (requireExactCount && a.count !== b.count) return false;
  if (!requireExactCount && Math.abs(a.count - b.count) > 1) return false;
  // Empty packs: only consistent with other empties.
  if (a.count === 0 && b.count === 0) return true;
  if (a.count === 0 || b.count === 0) return false;
  const overlap = listingOverlap(a, b);
  if (overlap < overlapMin) return false;
  // Soft rank check — don't reject when overlap is high but order wobbles a bit.
  if (overlap >= 0.95) return true;
  return rankOrderSimilarity(a, b) >= 0.7;
}

/**
 * Immediate accept vs needs-retry decision for a single observation.
 * Consensus acceptance is handled by the recovery loop, not here.
 */
export function decideSerpAccept(items: MapsLiveResult[]): SerpAcceptDecision {
  const n = items.length;
  if (n <= 0) return { action: "retry", reason: "empty" };
  if (n === 1) return { action: "retry", reason: "target_only" };
  if (n >= DESIRED_SERP_COUNT) return { action: "accept", reason: "full_pack" };
  if (n >= SOFT_ACCEPT_MIN_SERP) return { action: "accept", reason: "soft_pack" };
  return { action: "retry", reason: "sparse_needs_consensus" };
}

export function findConsensusGroup(
  observations: SerpObservation[],
  required = SERP_CONSENSUS_REQUIRED
): { group: SerpObservation[]; representative: SerpObservation } | null {
  if (observations.length < required) return null;

  for (let i = 0; i < observations.length; i++) {
    const seed = observations[i]!;
    const group: SerpObservation[] = [seed];
    for (let j = 0; j < observations.length; j++) {
      if (i === j) continue;
      if (observationsAreConsistent(seed, observations[j]!)) {
        group.push(observations[j]!);
      }
    }
    if (group.length >= required) {
      const picked = group.slice(0, required);
      return { group: picked, representative: selectMostRepresentative(picked) };
    }
  }
  return null;
}

/** Prefer the observation with highest average overlap to the rest of the group. */
export function selectMostRepresentative(group: SerpObservation[]): SerpObservation {
  if (group.length === 1) return group[0]!;
  let best = group[0]!;
  let bestScore = -1;
  for (const cand of group) {
    let sum = 0;
    for (const other of group) {
      if (other === cand) continue;
      sum += listingOverlap(cand, other);
    }
    const score = sum / Math.max(1, group.length - 1);
    if (score > bestScore) {
      bestScore = score;
      best = cand;
    }
  }
  return best;
}

export function serpConsensusRequired(): number {
  const n = Number(process.env.DATAFORSEO_SERP_CONSENSUS_REQUIRED ?? SERP_CONSENSUS_REQUIRED);
  return Number.isFinite(n) && n >= 2 ? Math.min(10, Math.floor(n)) : SERP_CONSENSUS_REQUIRED;
}

export function dfsLiveTailThreshold(): number {
  const n = Number(process.env.DATAFORSEO_LIVE_TAIL_THRESHOLD ?? DFS_LIVE_TAIL_THRESHOLD);
  return Number.isFinite(n) && n >= 1 ? Math.min(25, Math.floor(n)) : DFS_LIVE_TAIL_THRESHOLD;
}
