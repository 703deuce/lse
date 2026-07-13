import { cn } from "@/lib/utils";

/** Shared surfaces for the business overview dashboard */
export const dashboardCard =
  "rounded-xl border border-zinc-200/70 bg-white shadow-sm";

export const dashboardCardPad = "p-3";

export const dashboardSectionLabel =
  "text-[10px] font-semibold uppercase tracking-[0.08em] text-zinc-400";

export const dashboardCardTitle = "text-[13px] font-semibold tracking-tight text-zinc-900";

export const dashboardCardMeta = "text-[11px] leading-snug text-zinc-500";

export const dashboardBody = "text-[13px] leading-snug text-zinc-600";

export const dashboardMicro = "text-[11px] leading-snug text-zinc-500";

export const dashboardLink =
  "text-[12px] font-medium text-zinc-500 transition-colors hover:text-zinc-900";

export const dashboardAccentLink =
  "text-[12px] font-medium text-emerald-600 transition-colors hover:text-emerald-700";

export const dashboardControl =
  "h-8 rounded-lg border border-zinc-200/80 bg-white text-[13px] text-zinc-800 shadow-sm";

export const dashboardBadge =
  "inline-flex items-center rounded-md px-1.5 py-0.5 text-[10px] font-semibold";

export function dashboardCardClass(...extra: Array<string | false | undefined>) {
  return cn(dashboardCard, dashboardCardPad, ...extra);
}
