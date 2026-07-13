"use client";

import type { StoredCompetitor } from "@/lib/maps/grid-entity";
import { entityKeyFromParts } from "@/lib/maps/grid-entity";
import {
  dashboardCard,
  dashboardCardTitle,
  dashboardMicro,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

export type TopCompetitorRow = StoredCompetitor & {
  top3Appearances: number;
  totalCells: number;
  avgTop3Rank: number;
};

const BULLET_COLORS = [
  "bg-emerald-500",
  "bg-sky-500",
  "bg-violet-500",
  "bg-amber-500",
  "bg-rose-500",
  "bg-teal-500",
];

interface GridScanCompetitorsTableProps {
  competitors: TopCompetitorRow[];
  keyword?: string | null;
  onSelectCompetitor: (key: string, raw: StoredCompetitor) => void;
  className?: string;
}

export function GridScanCompetitorsTable({
  competitors,
  keyword,
  onSelectCompetitor,
  className = "",
}: GridScanCompetitorsTableProps) {
  if (!competitors.length) return null;

  return (
    <div className={cn(dashboardCard, "p-3 shadow-[0_1px_2px_rgba(0,0,0,0.04)]", className)}>
      <h3 className={dashboardCardTitle}>Top competitors this scan</h3>
      <p className={cn("mt-0.5", dashboardMicro)}>
        Top-3 local pack{keyword ? ` · “${keyword}”` : ""}
      </p>
      <div className="mt-2.5 overflow-x-auto">
        <table className="min-w-full text-left text-[12px]">
          <thead className="border-b border-zinc-100 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="pb-1.5 pr-3">Competitor</th>
              <th className="pb-1.5 pr-3">Category</th>
              <th className="pb-1.5 text-right">Top 3 / SoLV</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-50">
            {competitors.map((c, i) => {
              const solv = Math.round((c.top3Appearances / c.totalCells) * 10000) / 100;
              return (
                <tr key={c.cid ?? c.place_id ?? c.name ?? i}>
                  <td className="py-2 pr-3">
                    <div className="flex items-center gap-2">
                      <span
                        className={`h-2 w-2 shrink-0 rounded-full ${BULLET_COLORS[i % BULLET_COLORS.length]}`}
                      />
                      <button
                        type="button"
                        onClick={() => onSelectCompetitor(entityKeyFromParts(c), c)}
                        className="text-left text-[12px] font-medium text-zinc-900 hover:text-[#137752]"
                        title="View on map"
                      >
                        {c.name}
                      </button>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-zinc-500">{c.category ?? "—"}</td>
                  <td className="py-2 text-right tabular-nums text-zinc-600">
                    <span className="font-semibold text-zinc-900">
                      {c.top3Appearances}/{c.totalCells}
                    </span>{" "}
                    cells · SoLV {solv}% · avg #{c.avgTop3Rank}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
