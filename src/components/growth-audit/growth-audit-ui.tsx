"use client";

import type { LucideIcon } from "lucide-react";
import {
  BadgeCheck,
  ChevronRight,
  Info,
  Loader2,
  MoreVertical,
  Play,
  Star,
  TrendingUp,
} from "lucide-react";
import { SemiCircleGauge, Sparkline } from "@/components/overview/overview-charts";
import { cn } from "@/lib/utils";
import {
  TabBar,
  ModuleHeader,
  cardClass,
  cardLabelClass,
  StatValue,
  btnPrimary,
  btnIcon,
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
        <Star key={i} className={cn("h-3.5 w-3.5", i < count ? "fill-current" : "opacity-25")} />
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
    <span className={cn("shrink-0 rounded border px-2 py-0.5 text-[10px] font-bold tracking-wide", styles[priority])}>
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
    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold", styles[priority])}>
      {labels[priority]}
    </span>
  );
}

export function DifficultyTag({ difficulty }: { difficulty: string }) {
  const isEasy = difficulty === "easy";
  return (
    <span
      className={cn(
        "text-xs font-medium capitalize",
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
  return (
    <div className={cn(cardClass, "p-5", className)}>
      {children}
    </div>
  );
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
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        <div className="flex items-center gap-2">
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <Info className="h-3.5 w-3.5 text-zinc-400" />
        </div>
        {subtitle && <p className="mt-0.5 text-sm text-zinc-500">{subtitle}</p>}
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
      className="inline-flex items-center gap-1 text-sm font-medium text-emerald-600 hover:text-emerald-700"
    >
      {children}
      <ChevronRight className="h-4 w-4" />
    </button>
  );
}

export function MomentumPill({ delta }: { delta: number | null }) {
  if (delta == null || delta === 0) return null;
  const positive = delta > 0;
  return (
    <div
      className={cn(
        "mt-3 rounded-lg px-3 py-2 text-xs",
        positive ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
      )}
    >
      <span className="inline-flex items-center gap-1 font-semibold">
        <TrendingUp className={cn("h-3.5 w-3.5", !positive && "rotate-180")} />
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
  size = "lg",
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
  return (
    <GaCard className="flex flex-col">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-zinc-900">{title}</p>
        <Info className="h-3.5 w-3.5 text-zinc-400" />
      </div>
      <div className="mt-2 flex flex-1 flex-col items-center justify-center py-2">
        <SemiCircleGauge score={score} size={size === "lg" ? 160 : 120} strokeWidth={size === "lg" ? 14 : 10} />
        <p className={cn("mt-1 text-sm font-semibold", status.className)}>{status.label}</p>
        {description && (
          <p className="mt-2 px-2 text-center text-xs leading-relaxed text-zinc-500">{description}</p>
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
    <GaCard className="!p-4">
      <div className="flex items-center justify-between gap-2">
        <p className={cardLabelClass}>{title}</p>
        <Info className="h-3 w-3 shrink-0 text-zinc-400" />
      </div>
      <div className="mt-2">
        <StatValue value={score} suffix="/100" className="text-2xl" score={score} />
      </div>
      <p className={cn("mt-0.5 text-xs font-semibold", status.className)}>{status.label}</p>
      <div className="mt-3">
        <Sparkline data={data} color="#059669" width={100} height={28} />
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
    <GaCard className="!p-4">
      <p className={cardLabelClass}>{title}</p>
      <div className="mt-2">
        <StatValue value={value} className={valueClassName} />
      </div>
      {subtitle && <p className="mt-1 text-xs text-zinc-500">{subtitle}</p>}
      {footer && <div className="mt-3">{footer}</div>}
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
  return (
    <GaCard className="!p-4">
      <div className="flex items-start gap-3">
        <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", iconClassName)}>
          <Icon className="h-4 w-4" />
        </span>
        <div>
          <p className={cardLabelClass}>{label}</p>
          <div className="mt-0.5">
            <StatValue value={value} className="text-2xl" />
          </div>
          <p className="text-xs text-zinc-500">{sub}</p>
        </div>
      </div>
    </GaCard>
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
      title="Google Maps Growth Audit"
      subtitle="One audit. One growth plan. Everything wrong with your Maps presence."
      icon={BadgeCheck}
      meta={
        startedAt ? (
          <p className="text-xs text-zinc-400">
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
            className={btnPrimary}
          >
            {running ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4 fill-current" />}
            Run Full Growth Audit
          </button>
          <button type="button" className={btnIcon} aria-label="More options">
            <MoreVertical className="h-4 w-4" />
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
      className="overflow-x-auto"
    />
  );
}

export function DotRow({ total, filled }: { total: number; filled: number }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1">
      {Array.from({ length: total }).map((_, i) => (
        <span
          key={i}
          className={cn("h-2 w-2 rounded-full", i < filled ? "bg-emerald-500" : "bg-zinc-200")}
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
    <div className="flex flex-wrap gap-1 rounded-lg border border-zinc-200 bg-zinc-50 p-1">
      {options.map((opt) => (
        <button
          key={opt.id}
          type="button"
          onClick={() => onChange(opt.id)}
          className={cn(
            "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
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
