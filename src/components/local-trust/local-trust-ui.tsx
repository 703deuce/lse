"use client";

import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  ChevronDown,
  Info,
  MapPin,
  Play,
  RefreshCw,
  Search,
} from "lucide-react";
import {
  dashboardCard,
  dashboardCardTitle,
  dashboardControl,
  dashboardMicro,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import {
  HeroPanel,
  MetricStrip,
  PageHeader,
  TabBar,
  btnGhost,
  btnPrimary,
  btnSecondary,
  heroMetricClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

export type LocalTrustTabId =
  | "overview"
  | "opportunities"
  | "rejected"
  | "competitors"
  | "history";

export const LOCAL_TRUST_TABS: { id: LocalTrustTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "opportunities", label: "Opportunities" },
  { id: "history", label: "Search History" },
  { id: "competitors", label: "Competitor Mentions" },
  { id: "rejected", label: "Rejected" },
];

export function TrustPageHeader() {
  return (
    <PageHeader
      title="Local Trust"
      description="Find high-signal local directories and citations worth pursuing."
    />
  );
}

export function TrustTopBar() {
  return null;
}

export function TrustMetaLine({
  city,
  state,
  county,
  createdAt,
}: {
  city?: string | null;
  state?: string | null;
  county?: string | null;
  createdAt?: string;
}) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!city && !createdAt) return null;

  const location = city && state ? `${city}, ${state}` : city ?? state ?? "";
  const lastRun =
    mounted && createdAt
      ? new Date(createdAt).toLocaleString("en-US", {
          month: "numeric",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        })
      : null;

  return (
    <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-zinc-500" suppressHydrationWarning>
      <MapPin className="h-3 w-3 text-emerald-600" />
      <span>
        {location}
        {county ? ` · ${county}` : ""}
        {lastRun ? ` · Last run ${lastRun}` : ""}
      </span>
      <Info className="h-3 w-3 text-zinc-400" />
    </div>
  );
}

export function TrustActionBar({
  businessId,
  isRunning,
  loading,
  onRefresh,
  onRun,
  runLabel = "Find opportunities",
  showRescan,
  onRescan,
  hideRun,
}: {
  businessId?: string;
  isRunning: boolean;
  loading: boolean;
  onRefresh: () => void;
  onRun: () => void;
  runLabel?: string;
  showRescan?: boolean;
  onRescan?: () => void;
  hideRun?: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onRefresh}
        disabled={loading}
        className={cn(btnGhost, "h-9 px-3 text-[13px]")}
      >
        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        Refresh
      </button>
      {showRescan && onRescan && (
        <button
          type="button"
          disabled={isRunning}
          onClick={onRescan}
          className={cn(btnSecondary, "h-9 px-3.5 text-[13px]")}
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Rescan market
        </button>
      )}
      {!hideRun && (
        <button
          type="button"
          disabled={isRunning}
          onClick={onRun}
          className={cn(btnPrimary, "h-9 px-3.5 text-[13px]")}
        >
          <Play className="h-3.5 w-3.5 fill-current" />
          {runLabel}
        </button>
      )}
      {businessId ? (
        <button
          type="button"
          className={cn(btnGhost, "h-9 px-3 text-[13px]")}
          onClick={() => {
            void import("@/lib/journey/report-staging").then(({ stageReportItem }) => {
              stageReportItem({
                businessId,
                source: "local_trust",
                title: "Local Trust findings",
                href: `/businesses/${businessId}/trust`,
              });
            });
          }}
        >
          Add to report
        </button>
      ) : null}
    </div>
  );
}

export function TrustKpiRow({
  opportunitiesFound,
  highPriority,
  relevanceScore,
  easyWins,
}: {
  opportunitiesFound: number | string;
  highPriority: number | string;
  relevanceScore: number | string;
  easyWins: number | string;
}) {
  return (
    <div className="space-y-3">
      <HeroPanel
        eyebrow="Local citations & directories"
        title="Opportunities found"
        description="High-signal places to earn mentions and strengthen local trust."
        metric={<span className={heroMetricClass}>{opportunitiesFound}</span>}
        metricLabel="Total opportunities"
      />
      <MetricStrip
        items={[
          { label: "High priority", value: String(highPriority) },
          { label: "Relevance score", value: String(relevanceScore) },
          { label: "Easy wins", value: String(easyWins) },
        ]}
      />
    </div>
  );
}

export function TrustQueryKpiRow({
  totalQueries,
  successfulDiscoveries,
  avgRelevance,
  uniqueDomains,
  lastRunDate,
  lastRunTime,
}: {
  totalQueries: number;
  successfulDiscoveries: number;
  avgRelevance: number | string;
  uniqueDomains: number;
  lastRunDate: string;
  lastRunTime: string;
}) {
  return (
    <MetricStrip
      items={[
        { label: "Total queries", value: String(totalQueries) },
        { label: "Successful discoveries", value: String(successfulDiscoveries) },
        { label: "Avg. relevance", value: String(avgRelevance) },
        { label: "Unique domains", value: String(uniqueDomains) },
        { label: "Last run", value: `${lastRunDate} ${lastRunTime}` },
      ]}
    />
  );
}

export function TrustTabs({
  active,
  onChange,
}: {
  active: LocalTrustTabId;
  onChange: (tab: LocalTrustTabId) => void;
}) {
  return (
    <TabBar
      tabs={LOCAL_TRUST_TABS.map((t) => ({
        ...t,
        muted: t.id === "rejected",
      }))}
      active={active}
      onChange={onChange}
      className="[&_button]:pb-2.5 [&_button]:text-[13px] [&>div]:gap-4"
    />
  );
}

export const trustFilterBarClass = cn(
  dashboardCard,
  "flex flex-wrap items-end gap-2 p-3.5"
);

export function TrustFilterBar({ children }: { children: ReactNode }) {
  return <div className={trustFilterBarClass}>{children}</div>;
}

export function TrustFilterPill({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="text-[10px]">
      <span className={cn("mb-1 block", dashboardSectionLabel)}>{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            dashboardControl,
            "h-auto min-w-[120px] appearance-none py-1.5 pl-2.5 pr-7 text-[12px] font-medium"
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      </div>
    </label>
  );
}

export function trustPriorityBadge(p: string) {
  const colors: Record<string, string> = {
    high: "bg-red-50 text-red-700 ring-1 ring-red-100",
    medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    low: "bg-blue-50 text-blue-700 ring-1 ring-blue-100",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
        colors[p] ?? colors.medium
      )}
    >
      {p}
    </span>
  );
}

export function trustDifficultyBadge(d: string) {
  const colors: Record<string, string> = {
    easy: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    hard: "bg-red-50 text-red-700 ring-1 ring-red-100",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold capitalize",
        colors[d] ?? colors.medium
      )}
    >
      {d}
    </span>
  );
}

export function trustImpactBadge(level: string) {
  const good = level === "high" || level === "low";
  return (
    <span className={cn("text-[11px] font-semibold capitalize", good ? "text-emerald-600" : "text-amber-600")}>
      {level}
    </span>
  );
}

export function ScoreDiamond({ score }: { score: number }) {
  const color =
    score >= 70
      ? "border-emerald-600 text-emerald-700"
      : score >= 50
        ? "border-emerald-400 text-emerald-600"
        : "border-zinc-300 text-zinc-600";
  return (
    <span
      className={cn(
        "inline-flex h-7 w-7 rotate-45 items-center justify-center rounded-sm border-2 bg-white text-[10px] font-bold",
        color
      )}
    >
      <span className="-rotate-45 tabular-nums">{score}</span>
    </span>
  );
}

export function AuthorityRing({ score, label }: { score: number; label: string }) {
  const pct = Math.min(100, score);
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative h-8 w-8">
        <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90">
          <circle cx="18" cy="18" r="14" fill="none" stroke="#e4e4e7" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="14"
            fill="none"
            stroke="#10b981"
            strokeWidth="3"
            strokeDasharray={`${(pct / 100) * 88} 88`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-zinc-700">
          {score}
        </span>
      </div>
      <span className="text-[11px] font-medium text-zinc-600">{label}</span>
    </div>
  );
}

export function localMatchDisplay(cityMatch: boolean, countyMatch: boolean) {
  if (cityMatch) {
    return (
      <span className="text-[11px] text-zinc-600">
        City <span className="text-emerald-600">✓</span>
      </span>
    );
  }
  if (countyMatch) {
    return (
      <span className="text-[11px] text-zinc-600">
        County <span className="text-emerald-600">✓</span>
      </span>
    );
  }
  return <span className="text-[11px] text-zinc-400">—</span>;
}

export function TrustPanelCard({
  title,
  subtitle,
  action,
  children,
  className,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn(dashboardCard, "overflow-hidden", className)}>
      <div className="flex items-start justify-between gap-2 border-b border-zinc-100 px-3.5 py-2.5">
        <div>
          <h3 className={dashboardCardTitle}>{title}</h3>
          {subtitle && <p className={cn("mt-0.5", dashboardMicro)}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-3.5">{children}</div>
    </div>
  );
}

export function TrustFooter({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 text-[11px] text-zinc-400">
      <Info className="h-3 w-3 shrink-0" />
      {message}
    </p>
  );
}

export function TrustFilterSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="text-[10px]">
      <span className={cn("mb-1 block", dashboardSectionLabel)}>{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={cn(
            dashboardControl,
            "h-auto w-full min-w-[120px] appearance-none py-1.5 pl-2.5 pr-7 text-[12px]"
          )}
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      </div>
    </label>
  );
}

export function TrustSearchInput({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="relative min-w-0 w-full flex-1 sm:min-w-[160px]">
      <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          dashboardControl,
          "h-auto w-full py-1.5 pl-8 pr-2.5 text-[12px] placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/30"
        )}
      />
    </div>
  );
}

export function domainInitials(domain: string): string {
  const parts = domain.replace(/^www\./i, "").split(".");
  const main = parts[0] ?? domain;
  return main.slice(0, 2).toUpperCase();
}

export const trustTableHeadClass = cn(
  dashboardSectionLabel,
  "border-b border-zinc-100 bg-zinc-50/80 text-left normal-case tracking-wide"
);
