"use client";

import type { RankByDistanceBucket } from "@/lib/maps/rank-by-distance";
import { rankLabel } from "@/lib/maps/grid-metrics";

export function RankByDistanceCard({ buckets }: { buckets: RankByDistanceBucket[] }) {
  const hasData = buckets.some((b) => b.cellCount > 0);
  if (!hasData) return null;

  return (
    <div className="rounded-lg border border-border bg-white p-3 dark:border-zinc-800 dark:bg-zinc-950">
      <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Rank by distance</p>
      <ul className="mt-2 space-y-1.5 text-sm">
        {buckets
          .filter((b) => b.cellCount > 0)
          .map((b) => (
            <li key={b.bucket} className="flex items-center justify-between gap-3">
              <span className="text-text-muted dark:text-text-muted">{b.label}</span>
              <span className="tabular-nums font-medium">
                avg #{rankLabel(b.avgRank)}
                <span className="ml-2 text-xs font-normal text-text-muted">
                  ({b.top3Count}/{b.cellCount} top 3)
                </span>
              </span>
            </li>
          ))}
      </ul>
    </div>
  );
}
