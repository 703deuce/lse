"use client";

import type { ComponentType, ReactNode } from "react";
import {
  BarChart3,
  Building2,
  Calendar,
  FileText,
  Info,
  LayoutDashboard,
  Map,
  MessageSquare,
  MessageSquareText,
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
  { id: "responses", label: "Responses", icon: MessageSquareText },
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
      actions={
        <>
          <button
            type="button"
            onClick={onRun}
            disabled={isRunning || !hasPrimary}
            className={cn(btnPrimary, "h-9 px-4 text-sm")}
          >
            <Play className="h-3.5 w-3.5" />
            Run Check
          </button>
          <button type="button" onClick={onRefresh} disabled={loading} className={cn(btnSecondary, "h-9 px-3 text-sm")}>
            <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
            Refresh
          </button>
          <Link href={`/businesses/${businessId}/ai-visibility/prompts`} className={cn(btnSecondary, "h-9 px-3 text-sm")}>
            <Settings className="h-3.5 w-3.5" />
            Prompts
          </Link>
          <button
            type="button"
            className={cn(btnSecondary, "h-9 px-3 text-sm")}
            onClick={() => {
              void import("@/lib/journey/report-staging").then(({ stageReportItem, reportsHrefForStaging }) => {
                stageReportItem({
                  businessId,
                  source: "ai_visibility",
                  title: "AI Visibility check",
                  href: `/businesses/${businessId}/ai-visibility`,
                });
                window.location.href = reportsHrefForStaging(businessId, {
                  type: "monthly",
                  source: "ai_visibility",
                });
              });
            }}
          >
            <FileText className="h-3.5 w-3.5" />
            Add to report
          </button>
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
  const completeRuns = runs.filter(
    (r) => r.status === "complete" || r.status === "completed_with_errors"
  );
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
    <div className="relative min-w-0 w-full">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Search for a competitor, engine, source, or topic…"
        className={cn(inputClass, "w-full py-2.5 pl-10 pr-3 shadow-sm")}
      />
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
      <div className={cn("p-3", bodyClassName)}>{children}</div>
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

const ENGINE_BRAND: Record<AiEngine, { active: string; inactive: string }> = {
  chatgpt: { active: "bg-[#10a37f] text-white", inactive: "bg-zinc-100 text-zinc-300" },
  perplexity: { active: "bg-[#1fb8cd] text-white", inactive: "bg-zinc-100 text-zinc-300" },
  gemini: { active: "bg-white text-blue-600 ring-1 ring-blue-200", inactive: "bg-zinc-100 text-zinc-300" },
  google_ai_overview: { active: "bg-white text-blue-600 ring-1 ring-zinc-200", inactive: "bg-zinc-100 text-zinc-300" },
  claude: { active: "bg-[#d97745] text-white", inactive: "bg-zinc-100 text-zinc-300" },
};

export function EngineLogo({ engine, className }: { engine: AiEngine; className?: string }) {
  if (engine === "chatgpt") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="currentColor" d="M12 3.1a4.3 4.3 0 0 1 4 2.8 4.4 4.4 0 0 1 2.9 7.6 4.3 4.3 0 0 1-4.1 5.7 4.4 4.4 0 0 1-7.5-1.7 4.4 4.4 0 0 1-2.2-7.8A4.3 4.3 0 0 1 9.3 4c.8-.6 1.7-.9 2.7-.9Zm2.8 4.2-4.3 2.5v1.7l4.3-2.5V7.3Zm-6.3 8 4.3 2.5 1.5-.9-4.3-2.5-1.5.9Zm8.1-2.4v-5l-1.5-.9v5l1.5.9Zm-9.2-1.8v5l1.5.9v-5l-1.5-.9Zm1.8-4.2 4.3 2.5 1.5-.9L10.7 6l-1.5.9Zm5.6 10.2v-5l-1.5-.9v5l1.5.9Z" />
      </svg>
    );
  }
  if (engine === "claude") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="currentColor" d="M12 3 4.8 19.8h3.1l1.4-3.5h5.4l1.4 3.5h3.1L12 3Zm-1.7 10.6L12 9.2l1.7 4.4h-3.4Z" />
      </svg>
    );
  }
  if (engine === "gemini") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="currentColor" d="M12 2.8c.9 4.7 3.5 7.3 8.2 8.2-4.7.9-7.3 3.5-8.2 8.2-.9-4.7-3.5-7.3-8.2-8.2 4.7-.9 7.3-3.5 8.2-8.2Z" />
      </svg>
    );
  }
  if (engine === "google_ai_overview") {
    return (
      <svg viewBox="0 0 24 24" className={className} aria-hidden>
        <path fill="#4285F4" d="M20.7 12.2c0-.7-.1-1.3-.2-1.8H12v3.4h4.9a4.2 4.2 0 0 1-1.8 2.7v2.2H18c1.7-1.6 2.7-3.8 2.7-6.5Z" />
        <path fill="#34A853" d="M12 21c2.4 0 4.4-.8 5.9-2.2l-2.9-2.2c-.8.5-1.8.8-3 .8a5.2 5.2 0 0 1-4.9-3.6h-3v2.3A8.9 8.9 0 0 0 12 21Z" />
        <path fill="#FBBC05" d="M7.1 13.8a5.4 5.4 0 0 1 0-3.6V7.9h-3a9 9 0 0 0 0 8.2l3-2.3Z" />
        <path fill="#EA4335" d="M12 6.6c1.3 0 2.5.5 3.4 1.3L18 5.3A8.7 8.7 0 0 0 12 3a8.9 8.9 0 0 0-7.9 4.9l3 2.3A5.2 5.2 0 0 1 12 6.6Z" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path fill="currentColor" d="M5 3h14v18h-3.1v-6.2H8.1V21H5V3Zm3.1 3v5.8h7.8V6H8.1Zm3.9.8 3 2.1-3 2.1-3-2.1 3-2.1Z" />
    </svg>
  );
}

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
              "flex h-7 w-7 items-center justify-center rounded-full shadow-sm",
              on ? brand.active : brand.inactive
            )}
          >
            <EngineLogo engine={e} className="h-4 w-4" />
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
  status,
  errorMessage,
}: {
  engine: AiEngine;
  mentioned: number;
  total?: number;
  status?: string | null;
  errorMessage?: string | null;
}) {
  const failed =
    status != null &&
    status !== "complete" &&
    ["failed", "rate_limited", "timed_out", "provider_failed", "unsupported", "skipped"].includes(
      status
    );
  const statusLabel =
    status === "rate_limited"
      ? "Rate limited"
      : status === "timed_out"
        ? "Timed out"
        : status === "provider_failed"
          ? "Provider failed"
          : status === "unsupported"
            ? "Unsupported"
            : status === "skipped"
              ? "Skipped"
              : "Failed";
  const pct = failed ? 0 : Math.round((mentioned / total) * 100);
  return (
    <div className="flex items-center gap-3">
      <span
        className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border shadow-sm",
          ENGINE_BRAND[engine].active
        )}
      >
        <EngineLogo engine={engine} className="h-4 w-4" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between text-xs">
          <span className="font-medium text-text">{ENGINE_LABELS[engine]}</span>
          <span className={cn("tabular-nums", failed ? "text-amber-700" : "text-text-muted")}>
            {failed ? statusLabel : `${mentioned}/${total} (${pct}%)`}
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div
            className={cn("h-full rounded-full", failed ? "bg-amber-400" : "bg-emerald-500")}
            style={{ width: failed ? "100%" : `${pct}%` }}
          />
        </div>
        {failed && errorMessage ? (
          <p className="mt-1 truncate text-[10px] text-amber-700" title={errorMessage}>
            {errorMessage}
          </p>
        ) : null}
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
