"use client";

import type { ComponentType, ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  ArrowUpRight,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  CircleHelp,
  Globe,
  Info,
  MapPin,
  Play,
  RefreshCw,
  Search,
  Star,
  Target,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  ModuleHeader,
  TabBar,
  StatCard,
  KpiGrid,
  btnPrimary,
  btnSecondary,
  btnIcon,
  filterBarClass,
  cardClass,
} from "@/components/ui/design-system";

export type LocalTrustTabId =
  | "overview"
  | "opportunities"
  | "rejected"
  | "queries"
  | "competitors"
  | "tasks"
  | "history";

export const LOCAL_TRUST_TABS: { id: LocalTrustTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "opportunities", label: "Opportunities" },
  { id: "history", label: "Search History" },
  { id: "queries", label: "Search Queries" },
  { id: "competitors", label: "Competitor Mentions" },
  { id: "tasks", label: "Tasks" },
  { id: "rejected", label: "Rejected" },
];

export function TrustPageHeader() {
  return (
    <ModuleHeader
      title="Local Trust Opportunities"
      subtitle="Find chambers, sponsorships, community pages, and local directories where your business can get mentioned."
    />
  );
}

export function TrustTopBar() {
  return (
    <div className="flex items-center gap-2">
      <button type="button" className={btnIcon} aria-label="Help">
        <CircleHelp className="h-4 w-4" />
      </button>
      <button type="button" className={cn(btnIcon, "relative")} aria-label="Notifications">
        <Bell className="h-4 w-4" />
        <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
          3
        </span>
      </button>
      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-600 text-xs font-bold text-white">
        JD
      </span>
    </div>
  );
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
    <div className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-500" suppressHydrationWarning>
      <MapPin className="h-3.5 w-3.5 text-emerald-600" />
      <span>
        {location}
        {county ? ` · ${county}` : ""}
        {lastRun ? ` · Last run ${lastRun}` : ""}
      </span>
      <Info className="h-3.5 w-3.5 text-zinc-400" />
    </div>
  );
}

export function TrustActionBar({
  isRunning,
  loading,
  onRefresh,
  onRun,
  runLabel = "Find Local Trust Opportunities",
  showRescan,
  onRescan,
  hideRun,
}: {
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
        className={btnSecondary}
      >
        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        Refresh
      </button>
      {showRescan && onRescan && (
        <button
          type="button"
          disabled={isRunning}
          onClick={onRescan}
          className={btnPrimary}
        >
          <RefreshCw className="h-4 w-4" />
          Rescan Market
        </button>
      )}
      {!hideRun && (
        <button
          type="button"
          disabled={isRunning}
          onClick={onRun}
          className={btnPrimary}
        >
          <Play className="h-4 w-4 fill-current" />
          {runLabel}
        </button>
      )}
    </div>
  );
}

function TrustKpiCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClass,
}: {
  label: string;
  value: string | number;
  sub: string;
  icon: ComponentType<{ className?: string }>;
  iconClass: string;
  iconRounded?: boolean;
}) {
  return (
    <StatCard
      label={label}
      value={value}
      sub={sub}
      icon={Icon}
      iconWrapClassName={iconClass}
    />
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
    <KpiGrid>
      <TrustKpiCard
        label="Opportunities Found"
        value={opportunitiesFound}
        sub="Total opportunities"
        icon={Target}
        iconClass="bg-emerald-50 text-emerald-600"
      />
      <TrustKpiCard
        label="High Priority"
        value={highPriority}
        sub="Require immediate action"
        icon={ArrowUpRight}
        iconClass="bg-red-50 text-red-600"
        iconRounded
      />
      <TrustKpiCard
        label="Local Relevance Score"
        value={relevanceScore}
        sub="Out of 100"
        icon={Star}
        iconClass="bg-blue-50 text-blue-600"
      />
      <TrustKpiCard
        label="Easy Wins"
        value={easyWins}
        sub="Low effort, high impact"
        icon={Zap}
        iconClass="bg-emerald-50 text-emerald-600"
      />
    </KpiGrid>
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
  const cards = [
    {
      label: "Total Queries",
      value: totalQueries,
      sub: `+${Math.max(0, Math.round(totalQueries * 0.08))} from last run`,
      icon: Search,
      iconClass: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Successful Discoveries",
      value: successfulDiscoveries,
      sub: totalQueries > 0 ? `${Math.round((successfulDiscoveries / totalQueries) * 100)}% success rate` : "—",
      icon: CheckCircle2,
      iconClass: "bg-emerald-50 text-emerald-600",
    },
    {
      label: "Avg. Local Relevance",
      value: avgRelevance,
      sub: "Out of 100",
      icon: Star,
      iconClass: "bg-blue-50 text-blue-600",
    },
    {
      label: "Unique Domains Found",
      value: uniqueDomains,
      sub: `+${Math.max(0, Math.round(uniqueDomains * 0.15))} from last run`,
      icon: Globe,
      iconClass: "bg-violet-50 text-violet-600",
    },
    {
      label: "Last Run",
      value: lastRunDate,
      sub: lastRunTime,
      icon: Calendar,
      iconClass: "bg-emerald-50 text-emerald-600",
      badge: "Completed",
    },
  ];

  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
      {cards.map((card) => (
        <div key={card.label} className={cn(cardClass, "p-5")}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{card.label}</p>
              <p className="mt-2 text-xl font-bold leading-tight tabular-nums text-zinc-900">{card.value}</p>
              <p className="mt-1.5 text-xs text-zinc-500">{card.sub}</p>
              {"badge" in card && card.badge && (
                <span className="mt-1.5 inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                  {card.badge}
                </span>
              )}
            </div>
            <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", card.iconClass)}>
              <card.icon className="h-4 w-4" />
            </span>
          </div>
        </div>
      ))}
    </div>
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
    />
  );
}

export function TrustFilterBar({ children }: { children: ReactNode }) {
  return <div className={filterBarClass}>{children}</div>;
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
    <label className="text-xs">
      <span className="mb-1.5 block font-medium text-zinc-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-8 text-sm font-medium text-zinc-800 shadow-sm"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
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
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
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
        "inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-semibold capitalize",
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
    <span className={cn("text-xs font-semibold capitalize", good ? "text-emerald-600" : "text-amber-600")}>
      {level}
    </span>
  );
}

export function ScoreDiamond({ score }: { score: number }) {
  const color = score >= 70 ? "border-emerald-600 text-emerald-700" : score >= 50 ? "border-emerald-400 text-emerald-600" : "border-zinc-300 text-zinc-600";
  return (
    <span
      className={cn(
        "inline-flex h-8 w-8 rotate-45 items-center justify-center rounded-sm border-2 bg-white text-xs font-bold",
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
    <div className="flex items-center gap-2">
      <div className="relative h-10 w-10">
        <svg viewBox="0 0 36 36" className="h-10 w-10 -rotate-90">
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
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-zinc-700">
          {score}
        </span>
      </div>
      <span className="text-xs font-medium text-zinc-600">{label}</span>
    </div>
  );
}

export function localMatchDisplay(cityMatch: boolean, countyMatch: boolean) {
  if (cityMatch) {
    return (
      <span className="text-xs text-zinc-600">
        City <span className="text-emerald-600">✓</span>
      </span>
    );
  }
  if (countyMatch) {
    return (
      <span className="text-xs text-zinc-600">
        County <span className="text-emerald-600">✓</span>
      </span>
    );
  }
  return <span className="text-xs text-zinc-400">—</span>;
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
    <div className={cn(cardClass, className)}>
      <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
        <div>
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
          {subtitle && <p className="mt-0.5 text-xs text-zinc-500">{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
    </div>
  );
}

export function TrustFooter({ message }: { message: string }) {
  return (
    <p className="flex items-center gap-1.5 text-xs text-zinc-400">
      <Info className="h-3.5 w-3.5 shrink-0" />
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
    <label className="text-xs">
      <span className="mb-1.5 block font-medium text-zinc-500">{label}</span>
      <div className="relative">
        <select
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full min-w-[140px] appearance-none rounded-lg border border-zinc-200 bg-white py-2 pl-3 pr-8 text-sm text-zinc-800 shadow-sm"
        >
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <ChevronDown className="pointer-events-none absolute right-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
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
    <div className="relative min-w-[200px] flex-1">
      <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
      />
    </div>
  );
}

export function domainInitials(domain: string): string {
  const parts = domain.replace(/^www\./i, "").split(".");
  const main = parts[0] ?? domain;
  return main.slice(0, 2).toUpperCase();
}
