import { cn } from "@/lib/utils";

/**
 * Shared product surfaces for all customer-facing modules.
 * Localo-style: soft studio canvas, elevated rounded cards, pill controls.
 */

/** Soft studio canvas behind every authenticated page. */
export const dashboardPageBg = "bg-[#F3F5F7]";

/** Elevated white card used across overview, reviews, audits, etc. */
export const dashboardCard =
  "rounded-2xl border border-zinc-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]";

/** Larger workspace shell (map + side panel, wide tables). */
export const dashboardWorkspace =
  "overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_10px_40px_rgba(15,23,42,0.07)]";

/** Divided list surface (scans, locations, campaigns pickers). */
export const dashboardList =
  "divide-y divide-zinc-100 overflow-hidden rounded-2xl border border-zinc-200/80 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]";

/** Dashed empty-state panel. */
export const dashboardEmpty =
  "rounded-2xl border border-dashed border-zinc-200 bg-white/80 px-6 py-10 text-center shadow-[0_8px_30px_rgba(15,23,42,0.04)]";

export const dashboardCardPad = "p-4";

export const dashboardSectionLabel =
  "text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400";

export const dashboardCardTitle =
  "text-[14px] font-semibold tracking-tight text-zinc-900";

export const dashboardCardMeta = "text-[11px] leading-snug text-zinc-500";

export const dashboardBody = "text-[13px] leading-snug text-zinc-600";

export const dashboardMicro = "text-[11px] leading-snug text-zinc-500";

export const dashboardLink =
  "text-[12px] font-medium text-zinc-500 transition-colors hover:text-zinc-900";

export const dashboardAccentLink =
  "text-[12px] font-medium text-[#137752] transition-colors hover:text-[#0f6344]";

export const dashboardControl =
  "h-9 rounded-xl border border-zinc-200/80 bg-white text-[13px] text-zinc-800 shadow-[0_1px_2px_rgba(15,23,42,0.04)]";

export const dashboardBadge =
  "inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold";

/** Secondary / chrome pill button. */
export const dashboardBtnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-full border border-zinc-200/90 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-zinc-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300 disabled:opacity-50";

/** Primary CTA pill — brand green. */
export const dashboardBtnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-full bg-[#137752] px-3.5 py-1.5 text-[12px] font-semibold text-white shadow-[0_4px_14px_rgba(19,119,82,0.28)] transition hover:bg-[#0f6344] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137752] disabled:opacity-50";

export function dashboardCardClass(...extra: Array<string | false | undefined>) {
  return cn(dashboardCard, dashboardCardPad, ...extra);
}
