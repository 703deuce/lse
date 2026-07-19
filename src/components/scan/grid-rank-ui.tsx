"use client";

import {
  dashboardBtnPrimary,
  dashboardBtnSecondary,
  dashboardCard,
  dashboardCardTitle,
  dashboardControl,
  dashboardMicro,
  dashboardPageBg,
  dashboardSectionLabel,
  dashboardWorkspace,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

/** @deprecated Prefer dashboardPageBg — kept for grid call sites. */
export const gridRankPageBg = dashboardPageBg;

export const gridRankFieldLabel = dashboardSectionLabel;

export const gridRankFieldSelect = cn(
  dashboardControl,
  "mt-0.5 h-auto w-full px-2.5 py-1.5 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
);

export const gridInspectorActionBtn = dashboardBtnSecondary;

export const gridRankCardClass = dashboardCard;

export const gridRankWorkspaceClass = dashboardWorkspace;

export const gridRankHeaderBtn = dashboardBtnSecondary;

export const gridRankPrimaryBtn = dashboardBtnPrimary;

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
