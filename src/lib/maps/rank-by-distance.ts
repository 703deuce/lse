import {
  DISTANCE_BUCKET_LABELS,
  distanceBucketMiles,
  haversineMiles,
  type DistanceBucket,
} from "@/lib/maps/distance";
import {
  gridCellRingIndex,
  gridRingBucketLabel,
  gridRingDistancesMiles,
} from "@/lib/maps/grid-metrics";
import { normalizeRankForCalc } from "@/lib/maps/grid-entity";

export type RankByDistanceBucket = {
  bucket: string;
  label: string;
  cellCount: number;
  top3Count: number;
  avgRank: number | null;
};

function bucketStats(
  ranks: number[],
  top3: number,
  bucket: string,
  label: string
): RankByDistanceBucket {
  const avgRank =
    ranks.length > 0
      ? Math.round((ranks.reduce((s, r) => s + r, 0) / ranks.length) * 10) / 10
      : null;
  return { bucket, label, cellCount: ranks.length, top3Count: top3, avgRank };
}

export function computeGridRankByDistance(
  cells: Array<{
    row: number;
    col: number;
    rank: number | null;
    notInResults?: boolean;
  }>,
  gridSize: number,
  radiusMeters: number
): RankByDistanceBucket[] {
  const half = Math.floor(gridSize / 2);
  const ringMiles = gridRingDistancesMiles(gridSize, radiusMeters);
  const buckets = new Map<number, { ranks: number[]; top3: number }>();

  for (let ring = 0; ring <= half; ring++) {
    buckets.set(ring, { ranks: [], top3: 0 });
  }

  for (const cell of cells) {
    const ring = gridCellRingIndex(cell.row, cell.col, gridSize);
    const entry = buckets.get(ring);
    if (!entry) continue;
    const rank = cell.notInResults ? null : cell.rank;
    const normalized = normalizeRankForCalc(rank);
    entry.ranks.push(normalized);
    if (rank != null && rank <= 3) entry.top3 += 1;
  }

  return Array.from(buckets.entries()).map(([ring, { ranks, top3 }]) =>
    bucketStats(ranks, top3, `ring-${ring}`, gridRingBucketLabel(ring, ringMiles, gridSize))
  );
}

/** Legacy fixed 1 / 3 / 5 mi buckets when grid dimensions are unknown. */
export function computeRankByDistance(
  cells: Array<{
    lat: number;
    lng: number;
    rank: number | null;
    notInResults?: boolean;
  }>,
  centerLat: number,
  centerLng: number
): RankByDistanceBucket[] {
  const buckets: Record<DistanceBucket, { ranks: number[]; top3: number }> = {
    "0-1": { ranks: [], top3: 0 },
    "1-3": { ranks: [], top3: 0 },
    "3-5": { ranks: [], top3: 0 },
    "5+": { ranks: [], top3: 0 },
  };

  for (const cell of cells) {
    const miles = haversineMiles(centerLat, centerLng, cell.lat, cell.lng);
    const bucket = distanceBucketMiles(miles);
    const rank = cell.notInResults ? null : cell.rank;
    const normalized = normalizeRankForCalc(rank);
    buckets[bucket].ranks.push(normalized);
    if (rank != null && rank <= 3) buckets[bucket].top3 += 1;
  }

  return (Object.keys(buckets) as DistanceBucket[]).map((bucket) => {
    const { ranks, top3 } = buckets[bucket];
    return bucketStats(ranks, top3, bucket, DISTANCE_BUCKET_LABELS[bucket]);
  });
}
