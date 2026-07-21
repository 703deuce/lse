import { cn } from "@/lib/utils";

/**
 * Product surfaces — synced with design-system hierarchy.
 * Prefer HeroPanel / MetricStrip from design-system for page heroes.
 */

export const dashboardPageBg = "bg-[#EEF1F4]";

export const dashboardCard =
  "rounded-md border border-zinc-200/90 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.03)]";

export const dashboardWorkspace =
  "overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_8px_30px_rgba(15,23,42,0.06)]";

export const dashboardList =
  "divide-y divide-zinc-100 overflow-hidden rounded-md border border-zinc-200/90 bg-white";

export const dashboardEmpty =
  "rounded-md border border-dashed border-zinc-300 bg-zinc-50/50 px-5 py-10 text-center";

export const dashboardCardPad = "p-4";

export const dashboardSectionLabel =
  "text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500";

export const dashboardCardTitle =
  "text-base font-semibold tracking-tight text-zinc-900";

export const dashboardCardMeta = "text-xs leading-snug text-zinc-500";

export const dashboardBody = "text-sm leading-relaxed text-zinc-600";

export const dashboardMicro = "text-xs leading-snug text-zinc-500";

export const dashboardLink =
  "text-sm font-medium text-zinc-500 transition-colors hover:text-zinc-900";

export const dashboardAccentLink =
  "text-sm font-medium text-[#137752] transition-colors hover:text-[#0f6344]";

export const dashboardControl =
  "h-9 rounded-md border border-zinc-200 bg-white text-sm text-zinc-800";

export const dashboardBadge =
  "inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-semibold";

export const dashboardBtnSecondary =
  "inline-flex items-center justify-center gap-1.5 rounded-md border border-zinc-200 bg-white px-3 py-1.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-300 disabled:opacity-50";

export const dashboardBtnPrimary =
  "inline-flex items-center justify-center gap-1.5 rounded-md bg-[#137752] px-3.5 py-2 text-sm font-semibold text-white transition hover:bg-[#0f6344] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#137752] disabled:opacity-50";

export function dashboardCardClass(...extra: Array<string | false | undefined>) {
  return cn(dashboardCard, dashboardCardPad, ...extra);
}
