"use client";

import type { ComponentType, ReactNode } from "react";
import {
  BarChart3,
  Building2,
  Calendar,
  FileText,
  Filter,
  Info,
  LayoutDashboard,
  Map,
  MessageSquare,
  PieChart,
  Play,
  RefreshCw,
  Search,
  Settings,
  Sparkles,
  History,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { ENGINE_LABELS, type AiEngine } from "@/lib/ai-visibility/types";
import { cn } from "@/lib/utils";
import {
  dashboardCard,
  dashboardCardTitle,
  dashboardMicro,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import {
  GridMetricCard,
  kpiCardSurface,
  kpiIconWrapClass,
  kpiLabelClass,
  kpiSubClass,
  kpiValueClass,
} from "@/components/ui/metric-card";
import {
  ModuleHeader,
  btnPrimary,
  btnSecondary,
  inputClass,
} from "@/components/ui/design-system";
import type { AiVisibilityTabId, RunView } from "./ai-visibility-types";
import type { RunSummary } from "@/lib/ai-visibility/types";

export const AI_VISIBILITY_TABS: { id: AiVisibilityTabId; label: string; icon: ComponentType<{ className?: string }> }[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { id: "mentions", label: "Mentions", icon: MessageSquare },
  { id: "landscape", label: "Search Landscape", icon: Map },
  { id: "evidence", label: "Evidence", icon: FileText },
  { id: "history", label: "Run History", icon: History },
];

const ENGINE_COLORS: Record<AiEngine, string> = {
  chatgpt: "bg-emerald-100 text-primary-muted border-primary/25",
  perplexity: "bg-sky-100 text-sky-800 border-sky-200",
  gemini: "bg-violet-100 text-violet-800 border-violet-200",
  google_ai_overview: "bg-amber-100 text-amber-800 border-amber-200",
  claude: "bg-orange-100 text-orange-800 border-orange-200",
};

export function AiVisibilityHeaderRow({
  businessId,
  isRunning,
  hasPrimary,
  loading,
  onRun,
  onRefresh,
}: {
  businessId: string;
  isRunning: boolean;
  hasPrimary: boolean;
  loading: boolean;
  onRun: () => void;
  onRefresh: () => void;
}) {
  return (
    <ModuleHeader
      title="AI Visibility"
      subtitle="Track how AI platforms discover and recommend your business."
      icon={Sparkles}
      actions={
        <>
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning || !hasPrimary}
            className={cn(btnPrimary, "h-8 px-3 text-[13px]")}
          >
            <Play className="h-3.5 w-3.5" />
            Run Check
          </button>
          <button type="button" onClick={onRefresh} disabled={loading} className={cn(btnSecondary, "h-8 px-3 text-[13px]")}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
          <Link href={`/businesses/${businessId}/ai-visibility/prompts`} className={cn(btnSecondary, "h-8 px-3 text-[13px]")}>
            <Settings className="h-3.5 w-3.5" />
            Manage Prompts
          </Link>
        </>
      }
    />
  );
}

export type MentionsViewMode = "current" | "across" | "by-engine";

export function AiVisibilityViewControls({
  runView,
  runs,
  onRunViewChange,
  formatRunLabel,
  variant = "default",
  mentionsMode = "current",
  onMentionsModeChange,
}: {
  runView: RunView;
  runs: RunSummary[];
  onRunViewChange: (view: RunView) => void;
  formatRunLabel: (r: RunSummary) => string;
  variant?: "default" | "mentions";
  mentionsMode?: MentionsViewMode;
  onMentionsModeChange?: (mode: MentionsViewMode) => void;
}) {
  const isCombined = runView === "combined";
  const completeRuns = runs.filter((r) => r.status === "complete");
  const latestId = completeRuns[0]?.id;

  const viewButtons =
    variant === "mentions"
      ? ([
          { id: "current" as const, label: "Current run" },
          { id: "across" as const, label: "Across runs" },
          { id: "by-engine" as const, label: "By engine" },
        ] as const)
      : ([
          { id: "current" as const, label: "Current run" },
          { id: "across" as const, label: "All runs combined" },
        ] as const);

  function handleViewClick(id: "current" | "across" | "by-engine") {
    if (variant === "mentions" && onMentionsModeChange) {
      onMentionsModeChange(id);
    }
    if (id === "across") {
      onRunViewChange("combined");
      return;
    }
    if (id === "current" && latestId) {
      onRunViewChange(latestId);
      return;
    }
    if (id === "by-engine" && latestId) {
      onRunViewChange(latestId);
    }
  }

  const activeView =
    variant === "mentions"
      ? mentionsMode
      : isCombined
        ? "across"
        : "current";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-[11px] font-medium text-zinc-500">View</span>
      <div className="inline-flex rounded-lg border border-zinc-200 bg-zinc-100/80 p-0.5">
        {viewButtons.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => handleViewClick(b.id)}
            className={cn(
              "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
              activeView === b.id
                ? "border border-emerald-600/30 bg-white text-emerald-700 shadow-sm"
                : "border border-transparent text-zinc-500 hover:text-zinc-700"
            )}
          >
            {b.label}
          </button>
        ))}
      </div>
      {!isCombined && (
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-medium text-zinc-500">Run</span>
          <select
            value={runView}
            onChange={(e) => onRunViewChange(e.target.value)}
            className="rounded-md border border-zinc-200 bg-white px-2 py-1 text-[11px] font-medium text-zinc-800 shadow-sm"
          >
            {completeRuns.map((r) => (
              <option key={r.id} value={r.id}>
                {formatRunLabel(r)}
              </option>
            ))}
          </select>
          {runView === latestId && (
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-700">
              Latest
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export function AiVisibilitySearchBar({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative min-w-0 flex-1">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
        <input
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Search for a competitor, engine, source, or topic…"
          className={cn(inputClass, "py-2.5 pl-10 pr-3 shadow-sm")}
        />
      </div>
      <button type="button" className={cn(btnSecondary, "h-9 px-3 text-[13px]")}>
        <Filter className="h-3.5 w-3.5" />
        Filter
      </button>
    </div>
  );
}

export function AiVisibilityTabFilters({
  primaryPrompt,
}: {
  primaryPrompt?: string | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3.5 py-2.5 shadow-sm">
      <label className="flex items-center gap-2 text-xs text-text-muted">
        Prompt
        <select className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-medium text-text">
          <option>{primaryPrompt ?? "Primary prompt"}</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-text-muted">
        Time range
        <select className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-medium text-text" defaultValue="30">
          <option value="30">Last 30 days</option>
          <option value="90">Last 90 days</option>
        </select>
      </label>
      <label className="flex items-center gap-2 text-xs text-text-muted">
        Engine
        <select className="rounded-md border border-border bg-surface px-2 py-1.5 text-xs font-medium text-text" defaultValue="all">
          <option value="all">All engines</option>
        </select>
      </label>
      <button
        type="button"
        className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-2.5 py-1.5 text-xs font-medium text-text hover:bg-surface-subtle"
      >
        <Filter className="h-3.5 w-3.5" />
        Filters
      </button>
    </div>
  );
}

export function AiVisibilityTabs({
  tab,
  onTabChange,
}: {
  tab: AiVisibilityTabId;
  onTabChange: (t: AiVisibilityTabId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-4 border-b border-zinc-200">
      {AI_VISIBILITY_TABS.map((t) => {
        const Icon = t.icon;
        const active = tab === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onTabChange(t.id)}
            className={cn(
              "inline-flex items-center gap-1.5 border-b-[3px] pb-2 text-[13px] font-medium transition-colors -mb-px",
              active
                ? "border-emerald-600 text-emerald-700"
                : "border-transparent text-zinc-500 hover:border-zinc-200 hover:text-zinc-700"
            )}
          >
            <Icon className={cn("h-3.5 w-3.5", active ? "text-emerald-600" : "text-zinc-400")} />
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

function MiniSparkline({ points }: { points: number[] }) {
  if (points.length < 2) {
    return (
      <svg viewBox="0 0 64 24" className="h-4 w-12 text-primary" aria-hidden>
        <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points="0,18 16,14 32,10 48,8 64,4" />
      </svg>
    );
  }
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const coords = points
    .map((v, i) => {
      const x = (i / (points.length - 1)) * 64;
      const y = 22 - ((v - min) / range) * 18;
      return `${x},${y}`;
    })
    .join(" ");
  return (
    <svg viewBox="0 0 64 24" className="h-4 w-12 text-primary" aria-hidden>
      <polyline fill="none" stroke="currentColor" strokeWidth="1.5" points={coords} />
    </svg>
  );
}

export function AiKpiCard({
  label,
  value,
  valueSuffix,
  sub,
  icon: Icon,
  iconClassName,
  sparkPoints,
  trend,
  trendLabel,
  children,
  hideValue,
}: {
  label: string;
  value: string | number;
  valueSuffix?: string;
  sub?: string;
  icon: LucideIcon;
  iconClassName?: string;
  sparkPoints?: number[];
  trend?: string;
  trendLabel?: string;
  children?: ReactNode;
  hideValue?: boolean;
}) {
  if (!hideValue && !children && !trend && !sparkPoints) {
    return (
      <GridMetricCard
        label={label}
        value={valueSuffix ? `${value} ${valueSuffix}` : value}
        sub={sub}
        icon={Icon}
        iconWrapClassName={cn("bg-emerald-50 text-emerald-600", iconClassName)}
        iconClassName="text-current"
      />
    );
  }

  return (
    <div className={cn(kpiCardSurface, "flex h-full flex-col")}>
      <div className="flex items-start justify-between gap-1.5">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1">
            <p className={kpiLabelClass}>{label}</p>
            <Info className="h-2.5 w-2.5 text-zinc-300" aria-hidden />
          </div>
          {!hideValue && (
            <p className={kpiValueClass}>
              {value}
              {valueSuffix ? <span className="ml-1 text-[11px] font-medium text-zinc-500">{valueSuffix}</span> : null}
            </p>
          )}
          {sub && <p className={kpiSubClass}>{sub}</p>}
          {trend && (
            <p className="mt-0.5 text-[11px] font-medium text-emerald-600">
              {trend.replace(/^▲/, "▲ ").replace(/^▼/, "▼ ")} {trendLabel}
            </p>
          )}
          {children}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span
            className={cn(
              kpiIconWrapClass,
              "bg-emerald-50 text-emerald-600",
              iconClassName
            )}
          >
            <Icon className="h-2.5 w-2.5" />
          </span>
          {sparkPoints && sparkPoints.length > 1 && <MiniSparkline points={sparkPoints} />}
        </div>
      </div>
    </div>
  );
}

export function AiPanel({
  children,
  className,
  title,
  subtitle,
  action,
  bodyClassName,
}: {
  children: ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  bodyClassName?: string;
}) {
  return (
    <div className={cn(dashboardCard, "overflow-hidden", className)}>
      {(title || action) && (
        <div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-3.5 py-2.5">
          <div>
            {title && <h3 className={dashboardCardTitle}>{title}</h3>}
            {subtitle && <p className={cn("mt-0.5", dashboardMicro)}>{subtitle}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={cn("p-3.5", bodyClassName)}>{children}</div>
    </div>
  );
}

export function EngineBadge({ engine }: { engine: AiEngine }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        ENGINE_COLORS[engine]
      )}
    >
      {ENGINE_LABELS[engine]}
    </span>
  );
}

const ENGINE_BRAND: Record<AiEngine, { active: string; inactive: string; glyph: string }> = {
  chatgpt: { active: "bg-emerald-500 text-white", inactive: "bg-zinc-100 text-zinc-300", glyph: "✦" },
  perplexity: { active: "bg-cyan-600 text-white", inactive: "bg-zinc-100 text-zinc-300", glyph: "◎" },
  gemini: { active: "bg-blue-600 text-white", inactive: "bg-zinc-100 text-zinc-300", glyph: "✧" },
  google_ai_overview: { active: "bg-gradient-to-br from-blue-500 via-red-400 to-amber-400 text-white", inactive: "bg-zinc-100 text-zinc-300", glyph: "G" },
  claude: { active: "bg-orange-500 text-white", inactive: "bg-zinc-100 text-zinc-300", glyph: "C" },
};

export function EngineIconRow({ engines, total = 5 }: { engines: AiEngine[]; total?: number }) {
  const all: AiEngine[] = ["chatgpt", "perplexity", "gemini", "google_ai_overview", "claude"];
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.slice(0, total).map((e) => {
        const on = engines.includes(e);
        const brand = ENGINE_BRAND[e];
        return (
          <span
            key={e}
            title={ENGINE_LABELS[e]}
            className={cn(
              "flex h-7 w-7 items-center justify-center rounded-full text-[10px] font-bold shadow-sm",
              on ? brand.active : brand.inactive
            )}
          >
            {brand.glyph}
          </span>
        );
      })}
    </div>
  );
}

export function EngineCoverageRow({
  engine,
  mentioned,
  total = 5,
}: {
  engine: AiEngine;
  mentioned: number;
  total?: number;
}) {
  const pct = Math.round((mentioned / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold",
          ENGINE_COLORS[engine]
        )}
      >
        {ENGINE_LABELS[engine].slice(0, 1)}
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-text">{ENGINE_LABELS[engine]}</span>
          <span className="tabular-nums text-text-muted">
            {mentioned}/{total} ({pct}%)
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      </div>
    </div>
  );
}

export function TintedKpiCard({
  label,
  value,
  sub,
  tint,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  sub: string;
  tint: "emerald" | "violet" | "sky" | "amber";
  icon: ComponentType<{ className?: string }>;
}) {
  const tints = {
    emerald: "bg-primary-subtle/80 border-primary/20",
    violet: "bg-violet-50/80 border-violet-100",
    sky: "bg-sky-50/80 border-sky-100",
    amber: "bg-amber-50/80 border-amber-100",
  };
  const iconTints = {
    emerald: "text-primary",
    violet: "text-violet-600",
    sky: "text-sky-600",
    amber: "text-amber-600",
  };
  return (
    <div className={cn("flex h-full flex-col rounded-lg border px-3.5 py-3 shadow-sm", tints[tint])}>
      <div className="flex items-start justify-between gap-1.5">
        <div>
          <p className={kpiLabelClass}>{label}</p>
          <p className={kpiValueClass}>{value}</p>
          <p className={cn(kpiSubClass, "text-zinc-600")}>{sub}</p>
        </div>
        <span className={cn(kpiIconWrapClass, "bg-white/70 shadow-sm", iconTints[tint])}>
          <Icon className="h-2.5 w-2.5" />
        </span>
      </div>
    </div>
  );
}

export function VisibilityScoreRing({ score }: { score: number }) {
  const pct = Math.min(100, Math.max(0, score));
  return (
    <div className="relative inline-flex h-9 w-9 items-center justify-center">
      <svg viewBox="0 0 36 36" className="h-9 w-9 -rotate-90">
        <circle cx="18" cy="18" r="14" fill="none" stroke="#e4e4e7" strokeWidth="3" />
        <circle
          cx="18"
          cy="18"
          r="14"
          fill="none"
          stroke="#16A34A"
          strokeWidth="3"
          strokeDasharray={`${(pct / 100) * 88} 88`}
          strokeLinecap="round"
        />
      </svg>
      <span className="absolute text-[10px] font-bold tabular-nums text-text">{pct}</span>
    </div>
  );
}

export function AiVisibilityFooter({ lastUpdated }: { lastUpdated?: string | null }) {
  return (
    <div className="space-y-3 border-t border-border pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-text-muted">
        <span className="inline-flex items-center gap-1.5">
          <RefreshCw className="h-3 w-3" />
          Last updated: {lastUpdated ? new Date(lastUpdated).toLocaleString() : "—"}
        </span>
        <span>AI Visibility data is aggregated from multiple AI platforms and may vary.</span>
      </div>
      <div className="flex justify-end">
        <button
          type="button"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-sm font-bold text-white shadow-sm"
          aria-label="Help"
        >
          ?
        </button>
      </div>
    </div>
  );
}

export function StatusPill({ yes, yesLabel = "Yes", noLabel = "No" }: { yes: boolean; yesLabel?: string; noLabel?: string }) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        yes ? "bg-emerald-100 text-primary-muted" : "bg-surface-subtle text-text-muted"
      )}
    >
      {yes ? yesLabel : noLabel}
    </span>
  );
}

export {
  BarChart3,
  Building2,
  Calendar,
  PieChart,
  Sparkles,
  TrendingUp,
  Users,
};
