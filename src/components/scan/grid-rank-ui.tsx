"use client";

import {
  dashboardCard,
  dashboardCardTitle,
  dashboardControl,
  dashboardMicro,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

export const gridRankPageBg = "bg-[#F9FAFB]";

export const gridRankFieldLabel = dashboardSectionLabel;

export const gridRankFieldSelect = cn(
  dashboardControl,
  "mt-0.5 h-auto w-full px-2.5 py-1.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
);

export const gridInspectorActionBtn =
  "inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-700 hover:bg-zinc-50";

export const gridRankCardClass = cn(dashboardCard, "shadow-[0_1px_2px_rgba(0,0,0,0.04)]");

export const gridRankHeaderBtn =
  "inline-flex items-center gap-1.5 rounded-md border border-zinc-200 bg-white px-2.5 py-1 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50";

export const gridRankPrimaryBtn =
  "inline-flex items-center gap-1.5 rounded-md bg-[#137752] px-3 py-1 text-[12px] font-semibold text-white hover:bg-[#0f6344] disabled:opacity-50";

export const gridRankSectionTitle = dashboardCardTitle;

export const gridRankMicro = dashboardMicro;

export function GridStarRating({
  rating,
  reviewCount,
}: {
  rating: number | null | undefined;
  reviewCount?: number | null;
}) {
  if (rating == null) return <span className="text-zinc-400">—</span>;
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap">
      <span className="inline-flex text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < full ? "text-amber-400" : "text-zinc-200"}>
            ★
          </span>
        ))}
      </span>
      <span className="text-[11px] font-medium tabular-nums text-zinc-800">
        {rating.toFixed(1)}
        {reviewCount != null ? ` (${reviewCount})` : ""}
      </span>
    </span>
  );
}

export function gridEntityPillClass(selected: boolean): string {
  return cn(
    "rounded-md border px-2.5 py-0.5 text-[12px] font-medium transition-colors",
    selected
      ? "border-[#137752] bg-[#137752] text-white"
      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
  );
}
