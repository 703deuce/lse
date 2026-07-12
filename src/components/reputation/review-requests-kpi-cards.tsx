"use client";

import type { ComponentType, ReactNode } from "react";
import { cardClass, cardLabelClass, StatValue } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

export function ReviewRequestsKpiCard({
  label,
  value,
  sub,
  trend,
  trendLabel,
  icon: Icon,
  iconClass,
  invertTrendColor = false,
}: {
  label: string;
  value: string | number;
  sub?: ReactNode;
  trend?: string;
  trendLabel?: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  invertTrendColor?: boolean;
}) {
  const trendUp = trend?.startsWith("↑");
  const trendDown = trend?.startsWith("↓");
  const trendGood = invertTrendColor ? trendDown : trendUp;
  const trendBad = invertTrendColor ? trendUp : trendDown;

  return (
    <div className={cn(cardClass, "p-5")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className={cardLabelClass}>{label}</p>
          <div className="mt-2">
            <StatValue value={value} />
          </div>
          {sub && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{sub}</p>}
          {trend && (
            <p className="mt-1.5 text-xs leading-relaxed">
              <span
                className={cn(
                  "font-semibold",
                  trendGood && "text-emerald-600",
                  trendBad && "text-red-600",
                  !trendGood && !trendBad && "text-zinc-500"
                )}
              >
                {trend}
              </span>
              {trendLabel && <span className="ml-1 text-zinc-500">{trendLabel}</span>}
            </p>
          )}
        </div>
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconClass)}>
          <Icon className="h-4 w-4" />
        </span>
      </div>
    </div>
  );
}

export function pctOfTotal(part: number, total: number): string {
  if (total <= 0) return "0% of total";
  return `${((part / total) * 100).toFixed(1)}% of total`;
}

export function responseRate(replies: number, sent: number): string {
  if (sent <= 0) return "0% response rate";
  return `${((replies / sent) * 100).toFixed(1)}% response rate`;
}

export function replyRate(replies: number, sent: number): string {
  if (sent <= 0) return "0% reply rate";
  return `${((replies / sent) * 100).toFixed(1)}% reply rate`;
}

export function failureRate(failed: number, total: number): string {
  if (total <= 0) return "0% failure rate";
  return `${((failed / total) * 100).toFixed(1)}% failure rate`;
}
