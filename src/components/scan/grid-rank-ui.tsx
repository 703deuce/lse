"use client";

import {
  dashboardCard,
  dashboardCardTitle,
  dashboardControl,
  dashboardMicro,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

/** Soft studio canvas — closer to modern local-SEO product pages. */
export const gridRankPageBg = "bg-[#F3F5F7]";

export const gridRankFieldLabel = dashboardSectionLabel;

export const gridRankFieldSelect = cn(
  dashboardControl,
  "mt-0.5 h-auto w-full rounded-xl px-2.5 py-1.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
);

export const gridInspectorActionBtn =
  "inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white px-2.5 py-1 text-[11px] font-semibold text-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-zinc-50";

/** Elevated white surface used for the map workspace and side panels. */
export const gridRankCardClass = cn(
  dashboardCard,
  "rounded-2xl border-zinc-200/80 shadow-[0_8px_30px_rgba(15,23,42,0.06)]"
);

export const gridRankWorkspaceClass =
  "overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.07)]";

export const gridRankHeaderBtn =
  "inline-flex items-center gap-1.5 rounded-full border border-zinc-200/90 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] hover:bg-zinc-50";

export const gridRankPrimaryBtn =
  "inline-flex items-center gap-1.5 rounded-full bg-[#137752] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(19,119,82,0.28)] hover:bg-[#0f6344] disabled:opacity-50";

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
      <span className="inline-flex text-[12px] leading-none text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < full ? "text-amber-400" : "text-zinc-200"}>
            ★
          </span>
        ))}
      </span>
      <span className="text-[12px] font-semibold tabular-nums text-zinc-800">
        {rating.toFixed(1)}
      </span>
      {reviewCount != null ? (
        <span className="text-[11px] tabular-nums text-zinc-500">
          ({reviewCount.toLocaleString()})
        </span>
      ) : null}
    </span>
  );
}

export function gridEntityPillClass(selected: boolean): string {
  return cn(
    "rounded-full border px-3 py-1 text-[12px] font-semibold transition-colors",
    selected
      ? "border-[#137752] bg-[#137752] text-white shadow-[0_4px_12px_rgba(19,119,82,0.22)]"
      : "border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 hover:bg-zinc-50"
  );
}
