import type { LucideIcon } from "lucide-react";
import { cardLabelClass, cardClass, StatValue } from "@/components/ui/design-system";
import { trendTextClass } from "@/lib/design/score-colors";
import { cn } from "@/lib/utils";

interface MetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  className?: string;
}

export function MetricCard({ label, value, sub, className }: MetricCardProps) {
  return (
    <div className={cn(cardClass, "p-5", className)}>
      <p className={cardLabelClass}>{label}</p>
      <div className="mt-2">
        <StatValue value={value} />
      </div>
      {sub ? <p className="mt-1.5 text-xs leading-relaxed text-zinc-500">{sub}</p> : null}
    </div>
  );
}

interface GridMetricCardProps {
  label: string;
  value: string | number;
  sub?: string;
  icon?: LucideIcon;
  iconWrapClassName?: string;
  iconClassName?: string;
  trendPositive?: boolean;
  variant?: "primary" | "default";
  className?: string;
}

export function GridMetricCard({
  label,
  value,
  sub,
  icon: Icon,
  iconWrapClassName = "bg-emerald-50",
  iconClassName = "text-emerald-600",
  trendPositive,
  variant = "default",
  className,
}: GridMetricCardProps) {
  const isPrimary = variant === "primary";
  return (
    <div className={cn(cardClass, "px-4 py-3", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className={cardLabelClass}>{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg",
              iconWrapClassName
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", iconClassName)} />
          </span>
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1.5 font-bold tabular-nums leading-none text-zinc-900",
          isPrimary ? "text-2xl" : "text-xl"
        )}
      >
        {value}
      </p>
      {sub ? (
        <p
          className={cn(
            "mt-1 text-xs leading-relaxed",
            trendPositive === true && "font-medium text-emerald-600",
            trendPositive === false && "font-medium text-red-600",
            trendPositive == null && "text-zinc-500"
          )}
        >
          {sub}
        </p>
      ) : null}
    </div>
  );
}

interface GridTopCellsGroupProps {
  top3: number;
  top10: number;
  top20: number;
  total: number;
  top10Delta?: number | null;
  className?: string;
}

export function GridTopCellsGroup({
  top3,
  top10,
  top20,
  total,
  top10Delta,
  className,
}: GridTopCellsGroupProps) {
  return (
    <div
      className={cn(
        "flex divide-x divide-zinc-100 rounded-xl border border-zinc-200/80 bg-white px-1 py-3 shadow-[0_1px_3px_rgba(0,0,0,0.04)]",
        className
      )}
    >
      {[
        { label: "Top 3", value: top3, sub: `of ${total}` },
        {
          label: "Top 10",
          value: top10,
          sub:
            top10Delta != null
              ? `${top10Delta >= 0 ? "+" : ""}${top10Delta} vs last`
              : undefined,
        },
        { label: "Top 20", value: top20, sub: "cells" },
      ].map((item) => (
        <div key={item.label} className="flex-1 px-3 text-center">
          <p className={cardLabelClass}>{item.label}</p>
          <p className="mt-1 text-xl font-bold tabular-nums leading-none text-zinc-900">{item.value}</p>
          {item.sub && (
            <p
              className={cn(
                "mt-1 text-xs",
                item.label === "Top 10" && top10Delta != null
                  ? trendTextClass(top10Delta)
                  : "text-zinc-500"
              )}
            >
              {item.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
}

const statusColors: Record<string, string> = {
  ready: "bg-emerald-100 text-emerald-800",
  rank_ready: "bg-sky-100 text-sky-800",
  enriching: "bg-amber-100 text-amber-800",
  scoring: "bg-amber-100 text-amber-800",
  ai_planning: "bg-violet-100 text-violet-800",
  partial: "bg-emerald-100 text-emerald-800",
  failed: "bg-red-100 text-red-800",
  queued: "bg-amber-100 text-amber-800",
  dispatching: "bg-blue-100 text-blue-800",
  provider_running: "bg-blue-100 text-blue-800",
  normalizing: "bg-blue-100 text-blue-800",
  draft: "bg-zinc-100 text-zinc-700",
};

export function StatusBadge({ status }: StatusBadgeProps) {
  const label = status.replace(/_/g, " ");
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-xs font-semibold capitalize",
        statusColors[status] ?? "bg-zinc-100 text-zinc-700"
      )}
    >
      {label}
    </span>
  );
}

interface BucketBadgeProps {
  bucket: string;
}

const bucketColors: Record<string, string> = {
  relevance: "bg-violet-100 text-violet-800",
  distance: "bg-sky-100 text-sky-800",
  prominence: "bg-orange-100 text-orange-800",
  trust: "bg-teal-100 text-teal-800",
};

export function BucketBadge({ bucket }: BucketBadgeProps) {
  return (
    <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize", bucketColors[bucket] ?? "")}>
      {bucket}
    </span>
  );
}
