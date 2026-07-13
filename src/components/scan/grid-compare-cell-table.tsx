"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Download, Filter, MoreVertical, Search } from "lucide-react";
import type { CellComparison } from "@/lib/maps/grid-entity";
import { rankLabel } from "@/lib/maps/grid-metrics";
import { compareCardClass, compareHeaderBtn } from "@/components/scan/grid-compare-ui";
import { cn } from "@/lib/utils";

type ChangeFilter = "all" | "improved" | "declined" | "unchanged";

interface GridCompareCellTableProps {
  cells: CellComparison[];
  baselineLabel: string;
  currentLabel: string;
  baselineDate?: string;
  currentDate?: string;
  headToHead?: boolean;
  highlightedCell?: string | null;
  onHighlightCell?: (label: string | null) => void;
  initialFilter?: ChangeFilter;
}

function formatLocation(lat: number, lng: number): string {
  return `${lat.toFixed(4)}°, ${lng.toFixed(4)}°`;
}

function movementLabel(direction: CellComparison["direction"], headToHead: boolean): string {
  if (headToHead) {
    if (direction === "improved") return "You";
    if (direction === "declined") return "Them";
    if (direction === "unchanged") return "Tie";
    return "—";
  }
  if (direction === "improved") return "Up";
  if (direction === "declined") return "Down";
  if (direction === "unchanged") return "Flat";
  return "—";
}

function changeTypeLabel(direction: CellComparison["direction"], headToHead: boolean): string {
  if (headToHead) {
    if (direction === "improved") return "You lead";
    if (direction === "declined") return "They lead";
    if (direction === "unchanged") return "Tied";
    return "Missing";
  }
  if (direction === "improved") return "Improved";
  if (direction === "declined") return "Declined";
  if (direction === "unchanged") return "Unchanged";
  return "Missing";
}

export function GridCompareCellTable({
  cells,
  baselineLabel,
  currentLabel,
  baselineDate,
  currentDate,
  headToHead = false,
  highlightedCell,
  onHighlightCell,
  initialFilter = "all",
}: GridCompareCellTableProps) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<ChangeFilter>(initialFilter);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return cells.filter((c) => {
      if (filter !== "all" && c.direction !== filter) return false;
      if (!q) return true;
      return (
        c.label.toLowerCase().includes(q) ||
        formatLocation(c.lat, c.lng).toLowerCase().includes(q)
      );
    });
  }, [cells, search, filter]);

  function exportCsv() {
    const header = [
      "Cell",
      "Location",
      `${baselineLabel} Rank`,
      `${currentLabel} Rank`,
      "Change",
      "Movement",
      "Change Type",
    ];
    const rows = filtered.map((c) => [
      c.label,
      formatLocation(c.lat, c.lng),
      rankLabel(c.rankA),
      rankLabel(c.rankB),
      c.delta != null ? String(c.delta) : "",
      movementLabel(c.direction, headToHead),
      changeTypeLabel(c.direction, headToHead),
    ]);
    const csv = [header, ...rows].map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cell-comparison.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className={compareCardClass}>
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-200 px-3 py-2">
        <h3 className="text-[13px] font-semibold text-zinc-900">
          Cell-by-cell changes ({cells.length})
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              placeholder="Search cell or location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-48 rounded-md border border-zinc-200 py-1 pl-8 pr-2 text-[11px] text-zinc-900 shadow-sm placeholder:text-zinc-400"
            />
          </div>
          <button
            type="button"
            onClick={() =>
              setFilter((f) =>
                f === "all"
                  ? "improved"
                  : f === "improved"
                    ? "declined"
                    : f === "declined"
                      ? "unchanged"
                      : "all"
              )
            }
            className={cn(compareHeaderBtn, "py-1")}
          >
            <Filter className="h-3.5 w-3.5" />
            Filters
          </button>
          <button
            type="button"
            onClick={exportCsv}
            className={cn(compareHeaderBtn, "py-1")}
          >
            <Download className="h-3.5 w-3.5" />
            Export
          </button>
        </div>
      </div>
      <div className="max-h-64 overflow-auto">
        <table className="w-full text-left text-[11px]">
          <thead className="sticky top-0 bg-zinc-50 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-3 py-1.5">Cell</th>
              <th className="px-2.5 py-1.5">Location</th>
              <th className="px-2.5 py-1.5">
                Baseline Rank
                {baselineDate && (
                  <span className="mt-0.5 block font-normal normal-case text-zinc-400">
                    {baselineDate}
                  </span>
                )}
              </th>
              <th className="px-2.5 py-1.5">
                Current Rank
                {currentDate && (
                  <span className="mt-0.5 block font-normal normal-case text-zinc-400">
                    {currentDate}
                  </span>
                )}
              </th>
              <th className="px-2.5 py-1.5">Δ Change</th>
              <th className="px-2.5 py-1.5">Movement</th>
              <th className="px-2.5 py-1.5">Change Type</th>
              <th className="px-2.5 py-1.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => {
              const isHighlighted = highlightedCell === c.label;
              const badgeClass =
                c.direction === "improved"
                  ? "bg-emerald-50 text-emerald-700"
                  : c.direction === "declined"
                    ? "bg-red-50 text-red-700"
                    : "bg-zinc-100 text-zinc-600";

              return (
                <tr
                  key={c.label}
                  onMouseEnter={() => onHighlightCell?.(c.label)}
                  onMouseLeave={() => onHighlightCell?.(null)}
                  className={cn(
                    "border-t border-zinc-100 transition-colors",
                    isHighlighted && "bg-emerald-50/60"
                  )}
                >
                  <td className="px-3 py-1.5 font-semibold text-zinc-900">{c.label}</td>
                  <td className="px-2.5 py-1.5 text-zinc-500">{formatLocation(c.lat, c.lng)}</td>
                  <td className="px-2.5 py-1.5 font-medium text-zinc-800">{rankLabel(c.rankA)}</td>
                  <td className="px-2.5 py-1.5 font-medium text-zinc-800">{rankLabel(c.rankB)}</td>
                  <td className="px-2.5 py-1.5">
                    {c.delta != null ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                          c.direction === "improved"
                            ? "bg-emerald-50 text-emerald-700"
                            : c.direction === "declined"
                              ? "bg-red-50 text-red-700"
                              : "bg-zinc-100 text-zinc-600"
                        )}
                      >
                        {c.direction === "improved" && <ArrowUp className="h-2.5 w-2.5" />}
                        {c.direction === "declined" && <ArrowDown className="h-2.5 w-2.5" />}
                        {c.delta > 0 ? `+${c.delta}` : c.delta}
                      </span>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="px-2.5 py-1.5">
                    <span
                      className={cn(
                        "font-medium",
                        c.direction === "improved" && "text-emerald-600",
                        c.direction === "declined" && "text-red-600",
                        c.direction === "unchanged" && "text-zinc-500"
                      )}
                    >
                      {movementLabel(c.direction, headToHead)}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold",
                        badgeClass
                      )}
                    >
                      {changeTypeLabel(c.direction, headToHead)}
                    </span>
                  </td>
                  <td className="px-2.5 py-1.5 text-right">
                    <button
                      type="button"
                      className="inline-flex rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
                      aria-label={`Actions for cell ${c.label}`}
                    >
                      <MoreVertical className="h-3.5 w-3.5" />
                    </button>
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
