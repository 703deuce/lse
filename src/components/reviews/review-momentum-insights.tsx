"use client";

import type { ComponentType, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import Link from "next/link";
import {
  Calendar,
  Flag,
  Target,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
} from "lucide-react";
import { momentumBadgeClass, type MomentumLabel } from "@/lib/reviews/metrics";
import { GridMetricCard, KpiRow } from "@/components/ui/metric-card";
import {
  dashboardBadge,
  dashboardCard,
  dashboardCardMeta,
  dashboardCardTitle,
  dashboardMicro,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";
import { formatPace, MomentumPanel, MomentumSectionTitle } from "@/components/reviews/review-momentum-ui";
import {
  recencyStatusClass,
  type MarketInsights,
  type RecencyStatus,
  type VelocityTrendDirection,
} from "@/lib/reviews/market-insights";

export interface CoreScoreItem {
  label: string;
  value: number | string | null;
  href?: string;
  highlight?: boolean;
}

export function CoreScoresRow({ scores }: { scores: CoreScoreItem[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
      {scores.map((score) => {
        const content = (
          <div
            className={`rounded-xl border p-3.5 transition ${
              score.highlight
                ? "border-emerald-300 bg-primary-subtle/50 dark:border-emerald-800 dark:bg-emerald-950/30"
                : "border-border bg-surface dark:border-zinc-800 dark:bg-zinc-950"
            } ${score.href ? "hover:border-emerald-300 hover:shadow-sm dark:hover:border-emerald-700" : ""}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{score.label}</p>
            <p className="mt-1 text-base font-bold tabular-nums">
              {score.value ?? "—"}
            </p>
          </div>
        );
        return score.href ? (
          <Link key={score.label} href={score.href}>
            {content}
          </Link>
        ) : (
          <div key={score.label}>{content}</div>
        );
      })}
    </div>
  );
}

function velocityTrendClass(trend: VelocityTrendDirection): string {
  switch (trend) {
    case "accelerating":
      return "text-primary-muted bg-primary-subtle dark:bg-emerald-900/20 dark:text-emerald-300";
    case "losing":
      return "text-red-700 bg-red-50 dark:bg-red-900/20 dark:text-red-300";
    default:
      return "text-text bg-surface-subtle dark:bg-zinc-800 dark:text-zinc-300";
  }
}

function marketActivityClass(level: MarketInsights["marketActivityLevel"]): string {
  switch (level) {
    case "very_competitive":
      return "border-orange-200 bg-orange-50 text-orange-900 dark:border-orange-800 dark:bg-orange-900/20 dark:text-orange-100";
    case "moderate":
      return "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-100";
    default:
      return "border-border bg-surface-subtle text-text dark:border-zinc-700 dark:bg-zinc-900/50 dark:text-zinc-200";
  }
}

function formatDaysSince(days: number | null): string {
  if (days == null) return "Unknown";
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return `${days} days ago`;
}

export function ReviewMomentumTopKpis({
  momentumScore,
  momentumLabel,
  velocityTrend,
  velocityTrendLabel,
  targetSharePct,
  market,
}: {
  momentumScore: number;
  momentumLabel: MomentumLabel;
  velocityTrend: VelocityTrendDirection;
  velocityTrendLabel: string;
  targetSharePct: number;
  market: MarketInsights;
}) {
  return (
    <KpiRow cols={4}>
      <GridMetricCard
        variant="primary"
        label="Review Momentum™"
        value={Math.round(momentumScore)}
        sub={momentumLabel}
        icon={TrendingUp}
        iconWrapClassName="bg-emerald-50"
        iconClassName="text-emerald-600"
      />
      <GridMetricCard
        label="Velocity Trend"
        value={velocityTrendLabel}
        sub={
          velocityTrend === "accelerating"
            ? "Gaining share"
            : velocityTrend === "losing"
              ? "Losing share"
              : "Holding steady"
        }
        icon={velocityTrend === "losing" ? TrendingDown : TrendingUp}
        iconWrapClassName={
          velocityTrend === "losing" ? "bg-red-50" : velocityTrend === "accelerating" ? "bg-emerald-50" : "bg-zinc-100"
        }
        iconClassName={
          velocityTrend === "losing" ? "text-red-600" : velocityTrend === "accelerating" ? "text-emerald-600" : "text-zinc-500"
        }
        trendPositive={velocityTrend === "accelerating" ? true : velocityTrend === "losing" ? false : undefined}
      />
      <GridMetricCard
        label="Share of New Reviews (30D)"
        value={`${targetSharePct}%`}
        sub="You vs. competitors"
        icon={Users}
        iconWrapClassName="bg-sky-50"
        iconClassName="text-sky-600"
      />
      <GridMetricCard
        label="Market Activity"
        value={market.marketActivityLabel}
        sub={`${market.marketReviews30d} new reviews · top ${market.entityCount}`}
        icon={Users}
        iconWrapClassName="bg-violet-50"
        iconClassName="text-violet-600"
      />
    </KpiRow>
  );
}

export function MomentumSnapshotCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <GridMetricCard
      label={label}
      value={value}
      sub={sub}
      icon={Icon}
      iconWrapClassName="bg-zinc-100"
      iconClassName="text-zinc-500"
    />
  );
}

export function ReviewMomentumHero({
  momentumScore,
  momentumLabel,
  velocityTrend,
  velocityTrendLabel,
  targetSharePct,
}: {
  momentumScore: number;
  momentumLabel: MomentumLabel;
  velocityTrend: VelocityTrendDirection;
  velocityTrendLabel: string;
  targetSharePct: number;
}) {
  return (
    <MomentumPanel>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className={dashboardSectionLabel}>Review Momentum™</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <p className="text-lg font-semibold tabular-nums tracking-tight text-zinc-900">
              {Math.round(momentumScore)}
            </p>
            <span className={cn(dashboardBadge, momentumBadgeClass(momentumLabel))}>
              {momentumLabel}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-4 text-[13px]">
          <div>
            <p className={dashboardSectionLabel}>Velocity trend</p>
            <span
              className={cn(
                "mt-1 inline-flex rounded-md px-2 py-0.5 text-[12px] font-semibold",
                velocityTrendClass(velocityTrend)
              )}
            >
              {velocityTrendLabel}
            </span>
          </div>
          <div>
            <p className={dashboardSectionLabel}>Share of new reviews (30d)</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-zinc-900">{targetSharePct}%</p>
          </div>
        </div>
      </div>
    </MomentumPanel>
  );
}

export function WeeklyPacePanel({ market }: { market: MarketInsights }) {
  return (
    <MomentumPanel className="h-full">
      <MomentumSectionTitle
        title="Weekly Review Pace"
        subtitle={`Aim for ~${market.recommendedWeeklyPace} reviews per week to match leaders.`}
      />

      <div className="grid gap-2 sm:grid-cols-3">
        <PaceStat label="Current pace" value={`${formatPace(market.currentWeeklyPace)}/wk`} />
        <PaceStat
          label="Recommended"
          value={`${formatPace(market.recommendedWeeklyPace)}/wk`}
          highlight
        />
        <PaceStat
          label="Gap"
          value={`+${formatPace(market.weeklyPaceGap)}/wk`}
          sub="to close"
          difference
        />
      </div>

      <div className="mt-3 overflow-x-auto">
        <table className="min-w-full text-[12px]">
          <thead>
            <tr className="text-left">
              <th className={cn(dashboardSectionLabel, "pb-1.5 pr-3")}>Business</th>
              <th className={cn(dashboardSectionLabel, "pb-1.5")}>Avg / week</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {market.weeklyPace.map((row) => (
              <tr key={row.name}>
                <td className="py-1.5 pr-3 font-medium text-zinc-800">
                  {row.entityType === "target" ? "You" : row.name}
                </td>
                <td className="py-1.5 tabular-nums text-zinc-600">
                  {formatPace(row.avgReviewsPerWeek)}
                </td>
              </tr>
            ))}
            <tr className="font-semibold text-zinc-800">
              <td className="py-1.5 pr-3">Top 3 average</td>
              <td className="py-1.5 tabular-nums">{formatPace(market.top3AvgWeeklyPace)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </MomentumPanel>
  );
}

function PaceStat({
  label,
  value,
  sub,
  highlight,
  difference,
}: {
  label: string;
  value: string;
  sub?: string;
  highlight?: boolean;
  difference?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-lg border px-3.5 py-2",
        highlight && "border-emerald-100 bg-emerald-50/60",
        difference && "border-sky-100 bg-sky-50/60",
        !highlight && !difference && "border-zinc-100 bg-zinc-50/80"
      )}
    >
      <p className={dashboardSectionLabel}>{label}</p>
      <p
        className={cn(
          "mt-0.5 text-[13px] font-semibold tabular-nums leading-tight",
          difference ? "text-sky-700" : highlight ? "text-emerald-700" : "text-zinc-900"
        )}
      >
        {value}
      </p>
      {sub && <p className={cn(dashboardMicro, "mt-0.5")}>{sub}</p>}
    </div>
  );
}

export function ShareOfReviewsPanel({ market }: { market: MarketInsights }) {
  const sorted = [...market.shareOfNewReviews30d].sort((a, b) => b.sharePct - a.sharePct);
  const topCompetitorShare = sorted.find((r) => r.entityType !== "target" && r.sharePct > 0)?.sharePct;

  return (
    <MomentumPanel className="h-full">
      <MomentumSectionTitle
        title="Share of New Reviews"
        subtitle="Percent of new market reviews in the last 30 days."
      />
      <ul className="space-y-2.5">
        {sorted.map((row) => {
          const isTarget = row.entityType === "target";
          const isTopCompetitor =
            !isTarget && row.sharePct > 0 && row.sharePct === topCompetitorShare;
          return (
            <li key={row.name}>
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-medium text-zinc-800">{isTarget ? "You" : row.name}</span>
                <span className="font-semibold tabular-nums text-zinc-700">{row.sharePct}%</span>
              </div>
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-zinc-100">
                <div
                  className={cn(
                    "h-full rounded-full",
                    isTarget
                      ? "bg-emerald-600"
                      : isTopCompetitor
                        ? "bg-zinc-600"
                        : row.sharePct > 0
                          ? "bg-zinc-300"
                          : "bg-transparent"
                  )}
                  style={{
                    width: `${Math.max(row.sharePct > 0 ? 4 : 0, Math.min(100, row.sharePct))}%`,
                  }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </MomentumPanel>
  );
}

export function MomentumScoreBarsPanel({
  entities,
}: {
  entities: Array<{
    name: string;
    entity_type: string;
    momentum_score: number;
  }>;
}) {
  const sorted = [...entities].sort((a, b) => b.momentum_score - a.momentum_score);
  const maxScore = Math.max(...sorted.map((e) => e.momentum_score), 1);
  const topCompetitorName = sorted.find((e) => e.entity_type !== "target")?.name;

  return (
    <MomentumPanel className="h-full">
      <MomentumSectionTitle title="Momentum Score (30D)" subtitle="Velocity comparison." />
      <ul className="space-y-2.5">
        {sorted.map((e) => {
          const isTarget = e.entity_type === "target";
          const isTopCompetitor = !isTarget && e.name === topCompetitorName;
          const widthPct = Math.round((e.momentum_score / maxScore) * 100);
          const barColor = isTarget
            ? "bg-emerald-600"
            : isTopCompetitor
              ? "bg-zinc-600"
              : "bg-zinc-300";
          const score = Math.round(e.momentum_score);
          return (
            <li key={e.name}>
              <div className="flex items-center gap-2 text-[11px]">
                <span className="w-[38%] min-w-0 truncate font-medium text-zinc-800">
                  {isTarget ? "You" : e.name}
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="h-1 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={cn("h-full rounded-full", barColor)}
                      style={{ width: `${Math.max(widthPct, score > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "w-7 shrink-0 rounded px-1 py-0.5 text-center text-[10px] font-bold tabular-nums",
                      isTarget
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                        : "bg-zinc-100 text-zinc-700"
                    )}
                  >
                    {score}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </MomentumPanel>
  );
}

export function RecencyAndStreakPanel({
  entities,
  market,
}: {
  entities: Array<{ name: string; entity_type: string; days_since_last_review: number | null }>;
  market: MarketInsights;
}) {
  return (
    <MomentumPanel>
      <MomentumSectionTitle
        title="Days Since Last Review"
        subtitle="Fresh reviews signal active engagement."
      />
      <ul className="space-y-1.5">
        {entities
          .filter((e) => e.days_since_last_review != null || e.entity_type === "target")
          .slice(0, 6)
          .map((e) => {
            const days = e.days_since_last_review;
            const status: RecencyStatus =
              days == null ? "stale" : days <= 7 ? "fresh" : days <= 14 ? "warning" : "stale";
            return (
              <li
                key={e.name}
                className="flex items-center justify-between rounded-md bg-zinc-50/80 px-3.5 py-2 text-[12px]"
              >
                <span className="font-medium text-zinc-800">
                  {e.entity_type === "target" ? "You" : e.name.slice(0, 28)}
                </span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 text-[10px] font-semibold",
                    recencyStatusClass(status)
                  )}
                >
                  {formatDaysSince(days)}
                </span>
              </li>
            );
          })}
      </ul>

      <div className="mt-3 rounded-lg border border-zinc-100 bg-zinc-50/60 p-2.5">
        <p className={dashboardSectionLabel}>Review streak</p>
        {market.reviewStreakWeeks > 0 ? (
          <p className="mt-1 text-[13px] font-semibold text-emerald-700">
            {market.reviewStreakWeeks} week{market.reviewStreakWeeks === 1 ? "" : "s"} with reviews
          </p>
        ) : market.daysWithoutReview != null && market.daysWithoutReview > 0 ? (
          <p className="mt-1 text-[13px] font-semibold text-red-600">
            No reviews for {market.daysWithoutReview} days
          </p>
        ) : (
          <p className={cn(dashboardMicro, "mt-1")}>Run an audit to calculate streak.</p>
        )}
      </div>
    </MomentumPanel>
  );
}

export function MarketActivityBanner({ market }: { market: MarketInsights }) {
  return (
    <MomentumPanel className={marketActivityClass(market.marketActivityLevel)}>
      <p className={dashboardSectionLabel}>Market review activity</p>
      <p className="mt-1 text-lg font-semibold">{market.marketActivityLabel}</p>
      <p className={cn(dashboardMicro, "mt-1.5 opacity-90")}>
        Top {market.entityCount} businesses received{" "}
        <span className="font-semibold">{market.marketReviews30d}</span> new reviews in 30 days.
      </p>
    </MomentumPanel>
  );
}

export function ReviewMomentumCardEnhanced({
  businessId,
  momentumScore,
  momentumLabel,
  weeklyPaceGap,
  targetSharePct,
  velocityTrendLabel,
  hasData,
}: {
  businessId: string;
  momentumScore: number | null;
  momentumLabel: MomentumLabel | null;
  weeklyPaceGap: number | null;
  targetSharePct: number | null;
  velocityTrendLabel: string | null;
  hasData: boolean;
}) {
  return (
    <Link
      href={`/businesses/${businessId}/review-momentum`}
      className="block rounded-xl border border-border p-3.5 transition hover:border-emerald-300 hover:shadow-sm dark:border-zinc-800 dark:hover:border-emerald-700"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Review Momentum™</h2>
        </div>
        {hasData && momentumScore != null && (
          <span className="text-lg font-bold tabular-nums text-primary-muted dark:text-emerald-400">
            {Math.round(momentumScore)}
          </span>
        )}
      </div>
      {hasData ? (
        <div className="mt-3 space-y-1 text-sm text-text-muted dark:text-text-muted">
          {momentumLabel && (
            <p>
              Status:{" "}
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${momentumBadgeClass(momentumLabel)}`}>
                {momentumLabel}
              </span>
              {velocityTrendLabel && (
                <span className="ml-2 text-xs text-text-muted">{velocityTrendLabel}</span>
              )}
            </p>
          )}
          {targetSharePct != null && (
            <p>
              Only <span className="font-semibold text-text dark:text-zinc-100">{targetSharePct}%</span> of
              new market reviews went to you (30d).
            </p>
          )}
          {weeklyPaceGap != null && weeklyPaceGap > 0 && (
            <p>
              Need <span className="font-semibold text-primary-muted dark:text-emerald-400">+{weeklyPaceGap} reviews/week</span> to
              match top competitors.
            </p>
          )}
        </div>
      ) : (
        <p className="mt-2 text-sm text-text-muted dark:text-text-muted">
          Compare review velocity vs competitors. Run a momentum audit.
        </p>
      )}
      <span className="mt-3 inline-block text-sm font-medium text-primary">
        Open Review Momentum →
      </span>
    </Link>
  );
}
