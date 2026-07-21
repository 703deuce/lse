import { cn } from "@/lib/utils";

/**
 * Shared product surfaces for all customer-facing modules.
 * Enterprise density: hairline borders, compact radius, minimal elevation.
 */

/** Soft studio canvas behind every authenticated page. */
export const dashboardPageBg = "bg-[#EEF1F4]";

/** Elevated white card used across overview, reviews, audits, etc. */
export const dashboardCard =
  "rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/** Larger workspace shell (map + side panel, wide tables). */
export const dashboardWorkspace =
  "overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/** Divided list surface (scans, locations, campaigns pickers). */
export const dashboardList =
  "divide-y divide-zinc-100 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

/** Dashed empty-state panel. */
export const dashboardEmpty =
  "rounded-lg border border-dashed border-zinc-200 bg-zinc-50/60 px-5 py-8 text-center";

export const dashboardCardPad = "p-3.5";

export const dashboardSectionLabel =
  "text-[10px] font-semibold uppercase tracking-[0.06em] text-zinc-500";

export const dashboardCardTitle =
  "text-[13px] font-semibold tracking-tight text-zinc-900";

export const dashboardCardMeta = "text-[11px] leading-snug text-zinc-500";

export const dashboardBody = "text-[13px] leading-snug text-zinc-600";

export const dashboardMicro = "text-[11px] leading-snug text-zinc-500";

export const dashboardLink =
  "text-[12px] font-medium text-zinc-500 transition-colors hover:text-zinc-900";

export const dashboardAccentLink =
  "text-[12px] font-medium text-[#137752] transition-colors hover:text-[#0f6344]";

export const dashboardControl =
  "h-8 rounded-md border border-zinc-200 bg-white text-[13px] text-zinc-800";

export const dashboardBadge =
  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";

/** Secondary / chrome button. */
export const dashboardBtnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300 disabled:opacity-50";

/** Primary CTA — brand green. */
export const dashboardBtnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-[#137752] px-3 py-1.5 text-[12px] font-semibold text-white transition hover:bg-[#0f6344] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137752] disabled:opacity-50";

export function dashboardCardClass(...extra: Array<string | false | undefined>) {
  return cn(dashboardCard, dashboardCardPad, ...extra);
}
