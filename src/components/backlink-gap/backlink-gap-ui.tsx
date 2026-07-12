"use client";

import type { ComponentType, ReactNode } from "react";
import {
  Bell,
  Calendar,
  CircleHelp,
  ClipboardList,
  Clock,
  Eye,
  Globe,
  ListPlus,
  Play,
  RefreshCw,
  Shield,
  Star,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import {
  ModuleHeader,
  TabBar,
  StatCard,
  KpiGrid,
  btnPrimary,
  btnSecondary,
  btnIcon,
  cardClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

export type BacklinkGapTabId = "overview" | "opportunities" | "matrix" | "ignored" | "tasks";

export const BACKLINK_GAP_TABS: { id: BacklinkGapTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "opportunities", label: "Opportunities" },
  { id: "matrix", label: "Competitor Matrix" },
  { id: "ignored", label: "Ignored / Spam" },
  { id: "tasks", label: "Tasks" },
];

export function GapPageHeader() {
  return (
    <ModuleHeader
      title="Competitor Backlink Gap"
      subtitle="Find websites linking to competitors but not to you."
    />
  );
}

export function GapTopBar({ businessId }: { businessId: string }) {
  return (
    <div className="flex items-center gap-2">
      <Link
        href={`/businesses/${businessId}/workspace`}
        className="inline-flex items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 shadow-sm hover:bg-zinc-50"
      >
        ← Maps Workspace
      </Link>
      <button type="button" className={btnIcon} aria-label="Help">
        <CircleHelp className="h-4 w-4" />
      </button>
      <button
        type="button"
        className={cn(btnIcon, "relative")}
        aria-label="Notifications"
      >
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

export function GapActionBar({
  isRunning,
  hasRun,
  loading,
  onRun,
  onRerun,
  onCreateTasks,
  onRefresh,
}: {
  isRunning: boolean;
  hasRun: boolean;
  loading: boolean;
  onRun: () => void;
  onRerun: () => void;
  onCreateTasks: () => void;
  onRefresh: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={onRun}
        disabled={isRunning}
        className={btnPrimary}
      >
        <Play className="h-4 w-4 fill-current" />
        Run Backlink Gap
      </button>
      <button type="button" onClick={onRerun} disabled={isRunning || !hasRun} className={btnSecondary}>
        <RefreshCw className="h-4 w-4" />
        Re-run
      </button>
      <button type="button" onClick={onCreateTasks} disabled={!hasRun || isRunning} className={btnSecondary}>
        <ListPlus className="h-4 w-4" />
        Create Tasks
      </button>
      <button type="button" onClick={onRefresh} disabled={loading} className={btnSecondary}>
        <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
        Refresh
      </button>
    </div>
  );
}

export function GapKpiRow({
  targetDomains,
  competitorDomains,
  missing,
  highPriority,
}: {
  targetDomains: number | string;
  competitorDomains: number | string;
  missing: number | string;
  highPriority: number | string;
}) {
  return (
    <KpiGrid>
      <StatCard label="Target Referring Domains" value={targetDomains} sub="Domains pointing to you" icon={Globe} />
      <StatCard label="Competitor Domains Found" value={competitorDomains} sub="Unique domains found" icon={Users} />
      <StatCard label="Missing Opportunities" value={missing} sub="Opportunities to capture" icon={Target} />
      <StatCard label="High Priority Links" value={highPriority} sub="High priority opportunities" icon={Star} />
    </KpiGrid>
  );
}

export function GapIgnoredKpiRow({
  ignored,
  spam,
  restored,
  review,
}: {
  ignored: number;
  spam: number;
  restored: number;
  review: number;
}) {
  return (
    <KpiGrid>
      <StatCard label="Ignored Domains" value={ignored} sub="Links you've ignored" icon={Eye} />
      <StatCard label="Spam Candidates" value={spam} sub="Flagged as potentially spam" icon={Shield} />
      <StatCard label="Restored Links" value={restored} sub="Restored to active" icon={RefreshCw} />
      <StatCard label="Review Needed" value={review} sub="Require your review" icon={ClipboardList} />
    </KpiGrid>
  );
}

export function GapTargetLine({
  targetDomain,
  competitorCount,
}: {
  targetDomain: string;
  competitorCount: number;
}) {
  return (
    <p className="flex flex-wrap items-center gap-1.5 text-sm text-zinc-500">
      <Target className="h-3.5 w-3.5 text-emerald-600" />
      Target domain: <span className="font-semibold text-zinc-900">{targetDomain}</span>
      {competitorCount > 0 && (
        <>
          <span className="text-zinc-300">•</span>
          {competitorCount} competitors analyzed
        </>
      )}
    </p>
  );
}

export function GapTabs({
  active,
  onChange,
}: {
  active: BacklinkGapTabId;
  onChange: (tab: BacklinkGapTabId) => void;
}) {
  return <TabBar tabs={BACKLINK_GAP_TABS} active={active} onChange={onChange} />;
}

export function GapPageFooter({
  competitorCount,
  createdAt,
}: {
  competitorCount: number;
  createdAt?: string;
}) {
  const freshDate = createdAt
    ? new Date(createdAt).toLocaleDateString("en-US", {
        month: "numeric",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : "—";

  const lastRunTime = createdAt
    ? new Date(createdAt).toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
      })
    : "—";

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-zinc-200 pt-4 text-xs text-zinc-500">
      <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
        <Clock className="h-3.5 w-3.5" />
        Last run: Today at {lastRunTime}
      </span>
      <span className="inline-flex items-center gap-1.5" suppressHydrationWarning>
        <Calendar className="h-3.5 w-3.5" />
        Data fresh as of {freshDate}
      </span>
      <span className="inline-flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5" />
        Competitors analyzed: {competitorCount}
      </span>
    </div>
  );
}

export function priorityBadge(p: string) {
  const colors: Record<string, string> = {
    high: "bg-red-50 text-red-700 ring-1 ring-red-100",
    medium: "bg-amber-50 text-amber-700 ring-1 ring-amber-100",
    low: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
    ignore: "bg-zinc-100 text-zinc-500 ring-1 ring-zinc-200",
  };
  const labels: Record<string, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
    ignore: "Ignore",
  };
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize",
        colors[p] ?? colors.medium
      )}
    >
      {labels[p] ?? p}
    </span>
  );
}

export function priorityPickBadge(p: string) {
  const label = p === "high" ? "High Priority" : p === "medium" ? "Medium Priority" : "Low Priority";
  const colors: Record<string, string> = {
    high: "text-emerald-700",
    medium: "text-amber-700",
    low: "text-zinc-500",
  };
  return (
    <span className={cn("text-[11px] font-semibold", colors[p] ?? colors.medium)}>{label}</span>
  );
}

export function linkBadge(passing: "passes" | "nofollow" | "unknown") {
  if (passing === "passes") {
    return (
      <span className="rounded-full bg-emerald-600 px-2 py-0.5 text-[11px] font-medium text-white">
        Dofollow
      </span>
    );
  }
  if (passing === "nofollow") {
    return (
      <span className="rounded-full bg-sky-600 px-2 py-0.5 text-[11px] font-medium text-white">
        Nofollow
      </span>
    );
  }
  return (
    <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-[11px] font-medium text-zinc-600">
      Unknown
    </span>
  );
}

export function topicalBadge(fit: "topical" | "random" | "unknown") {
  const styles: Record<string, string> = {
    topical: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100",
    random: "bg-sky-50 text-sky-700 ring-1 ring-sky-100",
    unknown: "bg-zinc-100 text-zinc-600 ring-1 ring-zinc-200",
  };
  const labels: Record<string, string> = {
    topical: "High",
    random: "Low",
    unknown: "Unclear",
  };
  return (
    <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-medium", styles[fit])}>
      {labels[fit]}
    </span>
  );
}

export function powerSegmentBar(score: number | null) {
  const v = score ?? 0;
  const filled = v >= 70 ? 3 : v >= 40 ? 2 : v > 0 ? 1 : 0;
  return (
    <div className="flex min-w-[72px] items-center gap-2">
      <span className="w-4 text-xs font-semibold tabular-nums text-zinc-900">{score ?? 0}</span>
      <div className="flex flex-1 gap-0.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn("h-1.5 flex-1 rounded-sm", n <= filled ? "bg-emerald-500" : "bg-zinc-200")}
          />
        ))}
      </div>
    </div>
  );
}

export function powerBar(score: number | null) {
  const v = score ?? 0;
  const color = v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-amber-500" : "bg-zinc-400";
  return (
    <div className="flex min-w-[88px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-zinc-200">
        <div className={`h-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className="w-7 text-right text-xs font-semibold tabular-nums text-zinc-900">
        {score ?? "—"}
      </span>
    </div>
  );
}

export function powerBarsVertical(score: number | null) {
  const v = score ?? 0;
  const level = v >= 70 ? 3 : v >= 40 ? 2 : 1;
  const color = v >= 70 ? "bg-emerald-500" : v >= 40 ? "bg-amber-500" : "bg-zinc-400";
  const label = v >= 70 ? "High" : v >= 40 ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-end gap-0.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn("w-1 rounded-sm", n <= level ? color : "bg-zinc-200")}
            style={{ height: `${n * 4 + 4}px` }}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-zinc-700">{label}</span>
    </div>
  );
}

export function boolCell(v: boolean) {
  return (
    <span className={cn("text-base font-bold", v ? "text-emerald-600" : "text-red-500")}>
      {v ? "✓" : "✕"}
    </span>
  );
}

export function PanelCard({
  title,
  icon: Icon,
  action,
  children,
  className,
  footer,
}: {
  title: string;
  icon?: ComponentType<{ className?: string }>;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  footer?: ReactNode;
}) {
  return (
    <div className={cn(cardClass, className)}>
      <div className="flex items-center justify-between gap-2 border-b border-zinc-100 px-5 py-3.5">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <Icon className="h-4 w-4" />
            </span>
          )}
          <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-5">{children}</div>
      {footer && <div className="border-t border-zinc-100 px-5 py-3">{footer}</div>}
    </div>
  );
}
