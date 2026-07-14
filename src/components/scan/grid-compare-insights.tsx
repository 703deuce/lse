"use client";

import { ArrowDown, ArrowUp, Lightbulb, StickyNote } from "lucide-react";
import type { CellComparison } from "@/lib/maps/grid-entity";
import { rankLabel } from "@/lib/maps/grid-metrics";
import { compareCardClass } from "@/components/scan/grid-compare-ui";
import {
  dashboardCardTitle,
  dashboardMicro,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

interface GridCompareInsightsProps {
  cells: CellComparison[];
  headToHead?: boolean;
  onViewAllGains?: () => void;
  onViewAllLosses?: () => void;
}

function topChanges(cells: CellComparison[], direction: "improved" | "declined", limit = 3) {
  return cells
    .filter((c) => c.direction === direction && c.delta != null)
    .sort((a, b) => Math.abs(b.delta ?? 0) - Math.abs(a.delta ?? 0))
    .slice(0, limit);
}

export function GridCompareInsights({
  cells,
  headToHead = false,
  onViewAllGains,
  onViewAllLosses,
}: GridCompareInsightsProps) {
  const gains = topChanges(cells, "improved");
  const losses = topChanges(cells, "declined");

  return (
    <div className="space-y-2.5">
      <div className={cn(compareCardClass, "p-3.5")}>
        <h3 className={dashboardCardTitle}>Insights</h3>
        <div className="mt-2.5 space-y-2.5">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Biggest gains
            </p>
            {gains.length === 0 ? (
              <p className={cn("mt-1", dashboardMicro)}>No improvements in this comparison.</p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {gains.map((c) => (
                  <li
                    key={c.label}
                    className="flex items-center justify-between gap-2 text-[11px] text-zinc-800"
                  >
                    <span>
                      <span className="font-semibold text-zinc-900">{c.label}</span>
                      {" ("}
                      {headToHead ? (
                        <>
                          You #{rankLabel(c.rankA)} → #{rankLabel(c.rankB)}
                        </>
                      ) : (
                        <>
                          Rank {rankLabel(c.rankA)} → {rankLabel(c.rankB)}
                        </>
                      )}
                      {")"}
                    </span>
                    {c.delta != null && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-emerald-600">
                        <ArrowUp className="h-3 w-3" />
                        {c.delta > 0 ? `+${c.delta}` : c.delta}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {gains.length > 0 && (
              <button
                type="button"
                onClick={onViewAllGains}
                className="mt-1.5 text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
              >
                View all gains
              </button>
            )}
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wide text-red-600">
              Biggest losses
            </p>
            {losses.length === 0 ? (
              <p className={cn("mt-1", dashboardMicro)}>No declines in this comparison.</p>
            ) : (
              <ul className="mt-1 space-y-1.5">
                {losses.map((c) => (
                  <li
                    key={c.label}
                    className="flex items-center justify-between gap-2 text-[11px] text-zinc-800"
                  >
                    <span>
                      <span className="font-semibold text-zinc-900">{c.label}</span>
                      {" ("}
                      {headToHead ? (
                        <>
                          You #{rankLabel(c.rankA)} → #{rankLabel(c.rankB)}
                        </>
                      ) : (
                        <>
                          Rank {rankLabel(c.rankA)} → {rankLabel(c.rankB)}
                        </>
                      )}
                      {")"}
                    </span>
                    {c.delta != null && (
                      <span className="inline-flex shrink-0 items-center gap-0.5 font-semibold text-red-600">
                        <ArrowDown className="h-3 w-3" />
                        {c.delta}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {losses.length > 0 && (
              <button
                type="button"
                onClick={onViewAllLosses}
                className="mt-1.5 text-[11px] font-medium text-red-600 hover:text-red-700"
              >
                View all losses
              </button>
            )}
          </div>
        </div>
      </div>

      <div className={cn(compareCardClass, "p-3.5")}>
        <div className="flex items-center gap-2">
          <StickyNote className="h-3.5 w-3.5 text-zinc-400" />
          <h3 className={dashboardCardTitle}>Scan notes</h3>
        </div>
        <p className={cn("mt-1.5", dashboardMicro)}>No notes added to either scan.</p>
        <button
          type="button"
          className="mt-1.5 text-[11px] font-medium text-emerald-700 hover:text-emerald-800"
        >
          Add note
        </button>
      </div>

      <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-2.5">
        <div className="flex gap-2">
          <Lightbulb className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
          <p className="text-[11px] leading-snug text-emerald-900">
            <span className="font-semibold">Tip:</span> Hover over any cell on the map or in the
            table to highlight that location.
          </p>
        </div>
      </div>
    </div>
  );
}
