"use client";

import { cn } from "@/lib/utils";

export type HeatmapRankCell = {
  rank: number | null;
  label?: string;
};

function cellStyle(rank: number | null): { bg: string; text: string } {
  if (rank == null || !Number.isFinite(rank) || rank <= 0) {
    return { bg: "#E4E7EC", text: "#667085" };
  }
  if (rank <= 3) return { bg: "#137752", text: "#FFFFFF" };
  if (rank <= 10) return { bg: "#FDB022", text: "#101828" };
  return { bg: "#F04438", text: "#FFFFFF" };
}

/** Circular ranking grid matching the Maps Overview mockup. */
export function VisibilityHeatmap({
  cells,
  gridSize,
  className,
}: {
  cells: HeatmapRankCell[];
  gridSize: number;
  className?: string;
}) {
  const size = Math.max(3, Math.min(gridSize || 7, 11));
  const filled: HeatmapRankCell[] =
    cells.length >= size * size
      ? cells.slice(0, size * size)
      : [
          ...cells,
          ...Array.from({ length: Math.max(0, size * size - cells.length) }, () => ({
            rank: null as number | null,
            label: undefined as string | undefined,
          })),
        ];

  return (
    <div className={cn("w-full", className)}>
      <div
        className="mx-auto grid w-full max-w-[420px] gap-1.5 sm:gap-2"
        style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
      >
        {filled.map((cell, i) => {
          const style = cellStyle(cell.rank);
          const label =
            cell.rank == null || cell.rank <= 0
              ? "—"
              : cell.rank > 20
                ? "20+"
                : String(Math.round(cell.rank));
          return (
            <div
              key={i}
              title={cell.label ?? `Rank ${label}`}
              className="flex aspect-square items-center justify-center rounded-full text-[10px] font-bold shadow-sm sm:text-[11px]"
              style={{ backgroundColor: style.bg, color: style.text }}
            >
              {label}
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-4 text-[11px] font-medium text-[#667085]">
        <LegendDot color="#137752" label="Top 3" />
        <LegendDot color="#FDB022" label="4–10" />
        <LegendDot color="#F04438" label="11+" />
        <LegendDot color="#E4E7EC" label="Not found" />
      </div>
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  );
}
