"use client";

import type { ComponentType, ReactNode } from "react";
import {
  Calendar,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Eye,
  Globe,
  ListPlus,
  Play,
  RefreshCw,
  Share2,
  Shield,
  Star,
  Target,
  Users,
} from "lucide-react";
import Link from "next/link";
import { mock } from "@/components/mockup/ui";
import { cn } from "@/lib/utils";

export type BacklinkGapTabId = "overview" | "opportunities" | "matrix" | "ignored" | "tasks";

export const BACKLINK_GAP_TABS: { id: BacklinkGapTabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "opportunities", label: "Opportunities" },
  { id: "matrix", label: "Competitor Matrix" },
  { id: "ignored", label: "Ignored / Spam" },
  { id: "tasks", label: "Tasks" },
];

export const gapControl =
  "h-9 rounded-lg border border-[#E6EAF0] bg-white px-3 text-[13px] font-medium text-[#344054] shadow-sm outline-none transition hover:bg-[#F9FAFB] focus:border-[#137752] focus:ring-1 focus:ring-[#137752]/20";

export function GapPageHeader({
  actions,
}: {
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className={mock.title}>Competitor Backlink Gap</h1>
        <p className={mock.subtitle}>
          Find websites linking to competitors but not to you.
        </p>
      </div>
      {actions}
    </div>
  );
}

export function GapTopBar({ businessId }: { businessId: string }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <Link href={`/businesses/${businessId}/scans`} className={mock.btnSecondary}>
        Maps Scans
      </Link>
      <button type="button" className={mock.btnGhost}>
        <Share2 className="h-4 w-4" />
        Share
      </button>
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
      <button type="button" onClick={onRun} disabled={isRunning} className={mock.btnPrimary}>
        <Play className="h-3.5 w-3.5 fill-current" />
        Run Backlink Gap
      </button>
      <button
        type="button"
        onClick={onRerun}
        disabled={isRunning || !hasRun}
        className={mock.btnSecondary}
      >
        <RefreshCw className="h-3.5 w-3.5" />
        Re-run
      </button>
      <button
        type="button"
        onClick={onCreateTasks}
        disabled={!hasRun || isRunning}
        className={mock.btnSecondary}
      >
        <ListPlus className="h-3.5 w-3.5" />
        Create Tasks
      </button>
      <button type="button" onClick={onRefresh} disabled={loading} className={mock.btnSecondary}>
        <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} />
        Refresh
      </button>
      <button type="button" className={mock.btnSecondary}>
        <Download className="h-3.5 w-3.5" />
        Export
      </button>
    </div>
  );
}

function GapMetricCard({
  label,
  value,
  sub,
  icon: Icon,
  iconClassName,
}: {
  label: string;
  value: ReactNode;
  sub?: string;
  icon?: ComponentType<{ className?: string }>;
  iconClassName?: string;
}) {
  return (
    <div className={cn(mock.card, "flex h-full flex-col p-4")}>
      <div className="flex items-start justify-between gap-2">
        <p className={mock.label}>{label}</p>
        {Icon ? (
          <span
            className={cn(
              "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#ECFDF3] text-[#137752]",
              iconClassName
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 text-[26px] font-bold leading-none tracking-tight text-[#101828]">{value}</p>
      {sub ? <p className="mt-1.5 text-xs text-[#667085]">{sub}</p> : null}
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
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <GapMetricCard
        label="Target Referring Domains"
        value={targetDomains}
        sub="Domains pointing to you"
        icon={Globe}
      />
      <GapMetricCard
        label="Competitor Domains Found"
        value={competitorDomains}
        sub="Unique domains found"
        icon={Users}
      />
      <GapMetricCard
        label="Missing Opportunities"
        value={missing}
        sub="Opportunities to capture"
        icon={Target}
      />
      <GapMetricCard
        label="High Priority Links"
        value={highPriority}
        sub="High priority opportunities"
        icon={Star}
      />
    </div>
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
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <GapMetricCard label="Ignored Domains" value={ignored} sub="Links you've ignored" icon={Eye} />
      <GapMetricCard
        label="Spam Candidates"
        value={spam}
        sub="Flagged as potentially spam"
        icon={Shield}
        iconClassName="bg-[#FEF3F2] text-[#B42318]"
      />
      <GapMetricCard
        label="Restored Links"
        value={restored}
        sub="Restored to active"
        icon={RefreshCw}
      />
      <GapMetricCard
        label="Review Needed"
        value={review}
        sub="Require your review"
        icon={ClipboardList}
        iconClassName="bg-[#FFFAEB] text-[#B54708]"
      />
    </div>
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
    <div className={cn(mock.card, "flex flex-wrap items-center gap-2 px-4 py-2.5")}>
      <Target className="h-3.5 w-3.5 text-[#137752]" />
      <p className="text-[13px] text-[#667085]">
        Target domain:{" "}
        <span className="font-semibold text-[#101828]">{targetDomain}</span>
        {competitorCount > 0 && (
          <>
            <span className="mx-1.5 text-[#D0D5DD]">·</span>
            {competitorCount} competitors analyzed
          </>
        )}
      </p>
    </div>
  );
}

export function GapTabs({
  active,
  onChange,
}: {
  active: BacklinkGapTabId;
  onChange: (tab: BacklinkGapTabId) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1 border-b border-[#E6EAF0]">
      {BACKLINK_GAP_TABS.map((tab) => {
        const isActive = tab.id === active;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={cn(
              "-mb-px border-b-2 px-3 pb-2.5 pt-1 text-sm font-semibold transition",
              isActive
                ? "border-[#137752] text-[#137752]"
                : "border-transparent text-[#667085] hover:text-[#344054]"
            )}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
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
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#E6EAF0] pt-3 text-[12px] text-[#667085]">
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
    high: mock.badgeRed,
    medium: mock.badgeAmber,
    low: "inline-flex items-center rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-semibold text-[#475467]",
    ignore: "inline-flex items-center rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-semibold text-[#98A2B3]",
  };
  const labels: Record<string, string> = {
    high: "High",
    medium: "Medium",
    low: "Low",
    ignore: "Ignore",
  };
  return (
    <span className={cn(colors[p] ?? colors.medium, "capitalize")}>{labels[p] ?? p}</span>
  );
}

export function priorityPickBadge(p: string) {
  const label = p === "high" ? "High Priority" : p === "medium" ? "Medium Priority" : "Low Priority";
  const colors: Record<string, string> = {
    high: "text-[#027A48]",
    medium: "text-[#B54708]",
    low: "text-[#667085]",
  };
  return <span className={cn("text-[11px] font-semibold", colors[p] ?? colors.medium)}>{label}</span>;
}

export function linkBadge(passing: "passes" | "nofollow" | "unknown") {
  if (passing === "passes") {
    return (
      <span className="rounded-full bg-[#137752] px-2 py-0.5 text-[11px] font-medium text-white">
        Dofollow
      </span>
    );
  }
  if (passing === "nofollow") {
    return (
      <span className="rounded-full bg-[#1570EF] px-2 py-0.5 text-[11px] font-medium text-white">
        Nofollow
      </span>
    );
  }
  return (
    <span className="rounded-full bg-[#E4E7EC] px-2 py-0.5 text-[11px] font-medium text-[#475467]">
      Unknown
    </span>
  );
}

export function topicalBadge(fit: "topical" | "random" | "unknown") {
  const styles: Record<string, string> = {
    topical: mock.badgeGreen,
    random: "inline-flex items-center rounded-full bg-[#EFF8FF] px-2 py-0.5 text-[11px] font-semibold text-[#175CD3]",
    unknown: "inline-flex items-center rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-semibold text-[#475467]",
  };
  const labels: Record<string, string> = {
    topical: "High",
    random: "Low",
    unknown: "Unclear",
  };
  return <span className={styles[fit]}>{labels[fit]}</span>;
}

export function powerSegmentBar(score: number | null) {
  const v = score ?? 0;
  const filled = v >= 70 ? 3 : v >= 40 ? 2 : v > 0 ? 1 : 0;
  return (
    <div className="flex min-w-[72px] items-center gap-2">
      <span className="w-4 text-xs font-semibold tabular-nums text-[#101828]">{score ?? 0}</span>
      <div className="flex flex-1 gap-0.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn("h-1.5 flex-1 rounded-sm", n <= filled ? "bg-[#137752]" : "bg-[#E4E7EC]")}
          />
        ))}
      </div>
    </div>
  );
}

export function powerBar(score: number | null) {
  const v = score ?? 0;
  const color = v >= 70 ? "bg-[#137752]" : v >= 40 ? "bg-[#F79009]" : "bg-[#98A2B3]";
  return (
    <div className="flex min-w-[88px] items-center gap-2">
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[#E4E7EC]">
        <div className={`h-full ${color}`} style={{ width: `${v}%` }} />
      </div>
      <span className="w-7 text-right text-xs font-semibold tabular-nums text-[#101828]">
        {score ?? "—"}
      </span>
    </div>
  );
}

export function powerBarsVertical(score: number | null) {
  const v = score ?? 0;
  const level = v >= 70 ? 3 : v >= 40 ? 2 : 1;
  const color = v >= 70 ? "bg-[#137752]" : v >= 40 ? "bg-[#F79009]" : "bg-[#98A2B3]";
  const label = v >= 70 ? "High" : v >= 40 ? "Medium" : "Low";
  return (
    <div className="flex items-center gap-2">
      <div className="flex items-end gap-0.5">
        {[1, 2, 3].map((n) => (
          <span
            key={n}
            className={cn("w-1 rounded-sm", n <= level ? color : "bg-[#E4E7EC]")}
            style={{ height: `${n * 4 + 4}px` }}
          />
        ))}
      </div>
      <span className="text-xs font-medium text-[#344054]">{label}</span>
    </div>
  );
}

export function boolCell(v: boolean) {
  return (
    <span className={cn("text-base font-bold", v ? "text-[#137752]" : "text-[#F04438]")}>
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
    <div className={cn(mock.card, "overflow-hidden", className)}>
      <div className="flex items-center justify-between gap-2 border-b border-[#F2F4F7] px-4 py-3">
        <div className="flex items-center gap-2">
          {Icon && (
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ECFDF3] text-[#137752]">
              <Icon className="h-3.5 w-3.5" />
            </span>
          )}
          <h3 className="text-sm font-semibold text-[#101828]">{title}</h3>
        </div>
        {action}
      </div>
      <div className="p-4">{children}</div>
      {footer && <div className="border-t border-[#F2F4F7] px-4 py-3">{footer}</div>}
    </div>
  );
}

export function GapEmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className={cn(mock.card, "border-dashed px-4 py-10 text-center")}>
      <h2 className="text-base font-semibold text-[#101828]">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-sm text-[#667085]">{body}</p>
    </div>
  );
}

export function GapCheckIcon() {
  return <CheckCircle2 className="h-4 w-4 text-[#137752]" />;
}
