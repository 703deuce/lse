"use client";

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ChevronRight,
  Info,
  Loader2,
  Play,
  Star,
  TrendingUp,
} from "lucide-react";
import { SemiCircleGauge, Sparkline } from "@/components/overview/overview-charts";
import {
  dashboardCard,
  dashboardCardTitle,
  dashboardMicro,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { GridMetricCard } from "@/components/ui/metric-card";
import { cn } from "@/lib/utils";
import {
  TabBar,
  ModuleHeader,
  btnPrimary,
} from "@/components/ui/design-system";

export const GROWTH_AUDIT_TABS = [
  { id: "overview", label: "Overview" },
  { id: "gbp", label: "GBP Profile" },
  { id: "website", label: "Website Match" },
  { id: "coverage", label: "Coverage" },
  { id: "competitor-gap", label: "Competitor Gap" },
  { id: "growth-plan", label: "Action Plan" },
] as const;

export type GrowthAuditTabId = (typeof GROWTH_AUDIT_TABS)[number]["id"];

export function scoreStatus(
  score: number,
  variant: "default" | "website" = "default"
): { label: string; className: string } {
  if (score >= 85) return { label: "Strong", className: "text-emerald-600" };
  if (score >= 70) return { label: "On Track", className: "text-emerald-600" };
  if (variant === "website" && score >= 65) return { label: "Good Match", className: "text-emerald-600" };
  return { label: "Needs Improvement", className: "text-amber-600" };
}

export function ImpactStars({ count, className }: { count: number; className?: string }) {
  return (
    <span className={cn("inline-flex gap-0.5 text-amber-500", className)}>
      {Array.from({ length: 5 }).map((_, i) => (
        <Star key={i} className={cn("h-3 w-3", i < count ? "fill-current" : "opacity-25")} />
      ))}
    </span>
  );
}

export function PriorityTag({ priority }: { priority: "high" | "medium" | "low" }) {
  const styles = {
    high: "border-red-200 bg-red-50 text-red-600",
    medium: "border-amber-200 bg-amber-50 text-amber-700",
    low: "border-emerald-200 bg-emerald-50 text-emerald-700",
  };
  const labels = { high: "HIGH", medium: "MEDIUM", low: "LOW" };
  return (
    <span className={cn("shrink-0 rounded border px-1.5 py-0.5 text-[10px] font-bold tracking-wide", styles[priority])}>
      {labels[priority]}
    </span>
  );
}

export function FixPriorityBadge({ priority }: { priority: "high" | "medium" }) {
  const styles = {
    high: "bg-red-100 text-red-700",
    medium: "bg-amber-100 text-amber-800",
  };
  const labels = { high: "High", medium: "Medium" };
  return (
    <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold", styles[priority])}>
      {labels[priority]}
    </span>
  );
}

export function DifficultyTag({ difficulty }: { difficulty: string }) {
  const isEasy = difficulty === "easy";
  return (
    <span
      className={cn(
        "text-[11px] font-medium capitalize",
        isEasy ? "text-emerald-600" : difficulty === "medium" ? "text-amber-600" : "text-red-600"
      )}
    >
      {difficulty}
    </span>
  );
}

export function GaCard({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={cn(dashboardCard, "p-3.5", className)}>{children}</div>;
}

export function GaSectionTitle({
  title,
  subtitle,
  action,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-2.5 flex items-start justify-between gap-3">
      <div>
        <div className="flex items-center gap-1.5">
          <h2 className={dashboardCardTitle}>{title}</h2>
          <Info className="h-3 w-3 text-zinc-400" />
        </div>
        {subtitle && <p className={cn("mt-0.5", dashboardMicro)}>{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function GaLink({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
    >
      {children}
      <ChevronRight className="h-3.5 w-3.5" />
    </button>
  );
}

export function MomentumPill({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) return null;
  const positive = delta > 0;
  return (
    <div
      className={cn(
        "mt-2 rounded-md px-2.5 py-1.5 text-[11px]",
        positive ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
      )}
    >
      <span className="inline-flex items-center gap-1 font-semibold">
        <TrendingUp className={cn("h-3 w-3", !positive && "rotate-180")} />
        {positive ? "+" : ""}
        {delta} points vs. last audit
      </span>
      {positive && <p className="mt-0.5 text-emerald-700">Keep going—strong momentum!</p>}
    </div>
  );
}

export function ScoreGaugeCard({
  title,
  score,
  delta,
  size = "md",
  description,
  statusVariant = "default",
}: {
  title: string;
  score: number;
  delta?: number | null;
  size?: "lg" | "md";
  description?: string;
  statusVariant?: "default" | "website";
}) {
  const status = scoreStatus(score, statusVariant);
  const gaugeSize = size === "lg" ? 120 : 96;
  return (
    <GaCard className="flex flex-col">
      <div className="flex items-center gap-1.5">
        <p className={dashboardCardTitle}>{title}</p>
        <Info className="h-3 w-3 text-zinc-400" />
      </div>
      <div className="mt-1 flex flex-1 flex-col items-center justify-center py-1">
        <SemiCircleGauge score={score} size={gaugeSize} strokeWidth={size === "lg" ? 10 : 8} />
        <p className={cn("mt-0.5 text-[12px] font-semibold", status.className)}>{status.label}</p>
        {description && (
          <p className={cn("mt-1.5 px-1 text-center leading-snug", dashboardMicro)}>{description}</p>
        )}
      </div>
      <MomentumPill delta={delta ?? null} />
    </GaCard>
  );
}

export function MiniScoreCard({
  title,
  score,
  sparkData,
}: {
  title: string;
  score: number;
  sparkData?: number[];
}) {
  const status = scoreStatus(score);
  const data = sparkData ?? [score - 8, score - 4, score - 2, score];
  return (
    <GaCard className="!p-3.5">
      <div className="flex items-center justify-between gap-2">
        <p className={dashboardSectionLabel}>{title}</p>
        <Info className="h-3 w-3 shrink-0 text-zinc-400" />
      </div>
      <p className="mt-0.5 text-base font-bold tabular-nums leading-none text-zinc-900">
        {score}
        <span className="text-[11px] font-medium text-zinc-400">/100</span>
      </p>
      <p className={cn("mt-0.5 text-[11px] font-semibold", status.className)}>{status.label}</p>
      <div className="mt-1.5">
        <Sparkline data={data} color="#059669" width={88} height={22} />
      </div>
    </GaCard>
  );
}

export function StatHighlightCard({
  title,
  value,
  subtitle,
  valueClassName,
  footer,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  valueClassName?: string;
  footer?: React.ReactNode;
}) {
  return (
    <GaCard className="!p-3.5">
      <p className={dashboardSectionLabel}>{title}</p>
      <p className={cn("mt-0.5 text-base font-bold tabular-nums leading-none text-zinc-900", valueClassName)}>
        {value}
      </p>
      {subtitle && <p className={cn("mt-0.5", dashboardMicro)}>{subtitle}</p>}
      {footer && <div className="mt-2">{footer}</div>}
    </GaCard>
  );
}

export function SummaryStatCard({
  icon: Icon,
  iconClassName,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  iconClassName: string;
  label: string;
  value: string | number;
  sub: string;
}) {
  const wrap = iconClassName.includes("bg-")
    ? iconClassName.split(" ").find((c) => c.startsWith("bg-")) ?? "bg-emerald-50"
    : "bg-emerald-50";
  const color = iconClassName.includes("text-")
    ? iconClassName.split(" ").find((c) => c.startsWith("text-")) ?? "text-emerald-600"
    : "text-emerald-600";

  return (
    <GridMetricCard
      label={label}
      value={value}
      sub={sub}
      icon={Icon}
      iconWrapClassName={wrap}
      iconClassName={color}
    />
  );
}

export function GrowthAuditHeader({
  startedAt,
  running,
  onRun,
}: {
  startedAt: string | null;
  running: boolean;
  onRun: () => void;
}) {
  return (
    <ModuleHeader
      title="Growth Audit"
      icon={BadgeCheck}
      className="[&_h1]:text-lg sm:[&_h1]:text-xl [&_p]:text-[13px] [&_p]:leading-snug"
      meta={
        startedAt ? (
          <p className={dashboardMicro}>
            Last run:{" "}
            {new Date(startedAt).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              year: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </p>
        ) : undefined
      }
      actions={
        <>
          <button
            type="button"
            disabled={running}
            onClick={onRun}
            className={cn(btnPrimary, "h-9 w-full px-3 text-[13px] sm:w-auto")}
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 fill-current" />}
            <span className="sm:hidden">Run Audit</span>
            <span className="hidden sm:inline">Run Full Growth Audit</span>
          </button>
        </>
      }
    />
  );
}

export function GrowthAuditTabs({
  tab,
  onTabChange,
}: {
  tab: GrowthAuditTabId;
  onTabChange: (tab: GrowthAuditTabId) => void;
}) {
  return (
    <TabBar
      tabs={[...GROWTH_AUDIT_TABS]}
      active={tab}
      onChange={onTabChange}
      className="overflow-x-auto [&_button]:pb-2.5 [&_button]:text-[13px] [&>div]:gap-4"
    />
  );
}

export function DotRow({ total, filled }: { total: number; filled: number }) {
  return (
    <div className="mt-1.5 flex flex-wrap gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn("h-1.5 w-1.5 rounded-full", i < filled ? "bg-emerald-500" : "bg-zinc-200")}
        />
      ))}
    </div>
  );
}

export function FilterPills({
  options,
  value,
  onChange,
}: {
  options: Array<{ id: string; label: string; count?: number }>;
  value: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
            value === opt.id ? "bg-white text-emerald-700 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
          )}
        >
          {opt.label}
          {opt.count != null ? ` (${opt.count})` : ""}
        </button>
      ))}
    </div>
  );
}
