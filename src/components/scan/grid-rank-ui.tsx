"use client";

import { mock } from "@/components/mockup/ui";
import { cn } from "@/lib/utils";

/** Rank Grid results surface — mockup kit tokens. */
export const gridRankPageBg = "bg-[#F9FAFB]";

export const gridRankFieldLabel = mock.label;

export const gridRankFieldSelect = cn(
  "mt-0.5 h-auto w-full rounded-lg border border-[#E6EAF0] bg-white px-2.5 py-1.5 text-sm text-[#101828] shadow-sm outline-none transition focus:border-[#137752] focus:ring-1 focus:ring-[#137752]/25"
);

export const gridInspectorActionBtn = cn(mock.btnSecondary, "h-8 px-2.5 text-[12px]");

export const gridRankCardClass = mock.cardPad;

export const gridRankWorkspaceClass = cn(
  mock.card,
  "overflow-hidden shadow-[0_1px_2px_rgba(16,24,40,0.04)]"
);

export const gridRankHeaderBtn = cn(mock.btnSecondary, "h-9 gap-1.5 px-3 text-[13px]");

export const gridRankPrimaryBtn = cn(mock.btnPrimary, "h-9 px-3.5 text-[13px]");

export const gridRankSectionTitle = "text-[15px] font-bold tracking-tight text-[#101828]";

export const gridRankMicro = "text-[12px] text-[#667085]";

export function GridStarRating({
  rating,
  reviewCount,
}: {
  rating: number | null | undefined;
  reviewCount?: number | null;
}) {
  if (rating == null) return <span className="text-[#98A2B3]">—</span>;
  const full = Math.round(rating);
  return (
    <span className="inline-flex items-center gap-0.5 whitespace-nowrap">
      <span className="inline-flex text-[11px] leading-none text-amber-400">
        {Array.from({ length: 5 }).map((_, i) => (
          <span key={i} className={i < full ? "text-amber-400" : "text-[#E6EAF0]"}>
            ★
          </span>
        ))}
      </span>
      <span className="text-[11px] font-semibold tabular-nums text-[#101828]">
        {rating.toFixed(1)}
      </span>
      {reviewCount != null ? (
        <span className="text-[10px] tabular-nums text-[#667085]">
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
      : "border-[#E6EAF0] bg-white text-[#344054] hover:border-[#D0D5DD] hover:bg-[#F9FAFB]"
  );
}
