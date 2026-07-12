"use client";

import type { ComponentType } from "react";
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
import { cardLabelClass, StatValue, cardClass } from "@/components/ui/design-system";
import { cn } from "@/lib/utils";
import { formatPace, momentumCardClass } from "@/components/reviews/review-momentum-ui";
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
            className={`rounded-xl border p-4 transition ${
              score.highlight
                ? "border-emerald-300 bg-primary-subtle/50 dark:border-emerald-800 dark:bg-emerald-950/30"
                : "border-border bg-surface dark:border-zinc-800 dark:bg-zinc-950"
            } ${score.href ? "hover:border-emerald-300 hover:shadow-sm dark:hover:border-emerald-700" : ""}`}
          >
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{score.label}</p>
            <p className="mt-1 text-3xl font-bold tabular-nums">
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
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <div className={cn(momentumCardClass, "flex min-h-[108px] flex-col justify-center p-5")}>
        <p className={cardLabelClass}>Review Momentum™</p>
        <div className="mt-2 flex flex-wrap items-center gap-2.5">
          <p className="text-4xl font-bold leading-none tabular-nums tracking-tight text-zinc-900">
            {Math.round(momentumScore)}
          </p>
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 ring-1 ring-emerald-200">
            <TrendingUp className="h-3 w-3 shrink-0" aria-hidden />
            {momentumLabel}
          </span>
        </div>
      </div>

      <div className={cn(momentumCardClass, "flex min-h-[108px] items-center p-5")}>
        <div>
          <p className={cardLabelClass}>Velocity Trend</p>
          <div className="mt-2 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50">
              {velocityTrend === "accelerating" ? (
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              ) : velocityTrend === "losing" ? (
                <TrendingDown className="h-4 w-4 text-red-600" />
              ) : (
                <TrendingUp className="h-4 w-4 text-zinc-400" />
              )}
            </span>
            <p
              className={cn(
                "text-xl font-semibold",
                velocityTrend === "accelerating" && "text-emerald-700",
                velocityTrend === "losing" && "text-red-600",
                velocityTrend === "stable" && "text-zinc-800"
              )}
            >
              {velocityTrendLabel}
            </p>
          </div>
        </div>
      </div>

      <div className={cn(momentumCardClass, "flex min-h-[108px] flex-col justify-center p-5")}>
        <p className={cardLabelClass}>Share of New Reviews (30D)</p>
        <p className="mt-2 text-4xl font-bold leading-none tabular-nums tracking-tight text-zinc-900">
          {targetSharePct}%
        </p>
        <p className="mt-1.5 text-xs text-zinc-500">You vs. competitors</p>
      </div>

      <div className={cn(momentumCardClass, "flex min-h-[108px] items-center p-5")}>
        <div className="flex items-start gap-2.5">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
            <Users className="h-4 w-4 text-emerald-600" />
          </span>
          <div>
            <p className={cardLabelClass}>Market Activity</p>
            <p className="mt-0.5 text-lg font-semibold text-zinc-900">{market.marketActivityLabel}</p>
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
              Top {market.entityCount} businesses in your scan received {market.marketReviews30d} new
              reviews in the last 30 days — below typical market pace.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function MomentumSnapshotCard({
  icon: Icon,
  label,
  value,
  sub,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className={cn(cardClass, "p-5")}>
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0">
          <p className={cardLabelClass}>{label}</p>
          <div className="mt-1.5">
            <StatValue value={value} />
          </div>
          {sub && <p className="mt-1 text-xs leading-relaxed text-zinc-500">{sub}</p>}
        </div>
      </div>
    </div>
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
    <div className="rounded-2xl border border-primary/25 bg-linear-to-br from-emerald-50 to-white p-6 dark:border-emerald-900 dark:from-emerald-950/40 dark:to-zinc-950">
      <div className="flex flex-wrap items-start justify-between gap-6">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-primary-muted dark:text-emerald-400">
            Review Momentum™
          </p>
          <p className="mt-2 text-5xl font-bold tabular-nums text-text dark:text-zinc-50">
            {Math.round(momentumScore)}
          </p>
          <span
            className={`mt-3 inline-flex rounded-full px-3 py-1 text-sm font-semibold ${momentumBadgeClass(momentumLabel)}`}
          >
            {momentumLabel}
          </span>
        </div>
        <div className="space-y-3 text-sm">
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">Velocity trend</p>
            <span
              className={`mt-1 inline-flex rounded-full px-3 py-1 font-semibold ${velocityTrendClass(velocityTrend)}`}
            >
              {velocityTrendLabel}
            </span>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-text-muted">Share of new reviews (30d)</p>
            <p className="mt-1 text-2xl font-bold tabular-nums">{targetSharePct}%</p>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WeeklyPacePanel({ market }: { market: MarketInsights }) {
  return (
    <div className={cn(momentumCardClass, "h-full p-4")}>
      <h3 className="text-sm font-semibold text-zinc-900">Weekly Review Pace</h3>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        To match top competitors, aim for ~{market.recommendedWeeklyPace} reviews every week.
      </p>

      <div className="mt-3 grid gap-2 sm:grid-cols-3">
        <PaceStat label="CURRENT PACE" value={`${formatPace(market.currentWeeklyPace)}/week`} />
        <PaceStat
          label="RECOMMENDED PACE"
          value={`${formatPace(market.recommendedWeeklyPace)}/week`}
          highlight
        />
        <PaceStat
          label="DIFFERENCE"
          value={`+${formatPace(market.weeklyPaceGap)} reviews/week`}
          sub="to close the gap"
          difference
        />
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-xs">
          <thead className="text-left text-[10px] font-semibold uppercase tracking-wide text-zinc-400">
            <tr>
              <th className="pb-2 pr-3 font-semibold">Business</th>
              <th className="pb-2 font-semibold">Avg Reviews / Week</th>
            </tr>
          </thead>
          <tbody>
            {market.weeklyPace.map((row) => (
              <tr key={row.name} className="border-t border-zinc-100">
                <td className="py-2 pr-3 font-medium text-zinc-800">
                  {row.entityType === "target" ? "You" : row.name}
                  {row.entityType === "target" && (
                    <span className="ml-1.5 rounded bg-zinc-200 px-1.5 py-0.5 text-[9px] font-bold text-zinc-600">
                      YOU
                    </span>
                  )}
                </td>
                <td className="py-2 tabular-nums text-zinc-700">
                  {formatPace(row.avgReviewsPerWeek)}
                </td>
              </tr>
            ))}
            <tr className="border-t border-zinc-200 font-semibold">
              <td className="py-2 pr-3 text-zinc-800">Top 3 average</td>
              <td className="py-2 tabular-nums text-zinc-800">
                {formatPace(market.top3AvgWeeklyPace)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
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
        "rounded-lg border px-2.5 py-2",
        highlight && "border-emerald-200 bg-emerald-50/80",
        difference && "border-sky-100 bg-sky-50",
        !highlight && !difference && "border-zinc-100 bg-zinc-50"
      )}
    >
      <p className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">{label}</p>
      <p
        className={cn(
          "mt-1 text-sm font-bold tabular-nums leading-tight",
          difference ? "text-sky-700" : highlight ? "text-emerald-700" : "text-zinc-900"
        )}
      >
        {value}
      </p>
      {sub && <p className="mt-0.5 text-[10px] text-zinc-500">{sub}</p>}
    </div>
  );
}

export function ShareOfReviewsPanel({ market }: { market: MarketInsights }) {
  const sorted = [...market.shareOfNewReviews30d].sort((a, b) => b.sharePct - a.sharePct);
  const topCompetitorShare = sorted.find((r) => r.entityType !== "target" && r.sharePct > 0)?.sharePct;

  return (
    <div className={cn(momentumCardClass, "h-full p-4")}>
      <h3 className="text-sm font-semibold text-zinc-900">Share of New Reviews - Last 30 Days</h3>
      <p className="mt-0.5 text-[11px] text-zinc-500">
        What percentage of new market reviews went to each business.
      </p>
      <ul className="mt-4 space-y-3.5">
        {sorted.map((row) => {
          const isTarget = row.entityType === "target";
          const isTopCompetitor =
            !isTarget && row.sharePct > 0 && row.sharePct === topCompetitorShare;
          return (
            <li key={row.name}>
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium text-zinc-800">
                  {isTarget ? "You" : row.name}
                </span>
                <span className="tabular-nums font-semibold text-zinc-800">{row.sharePct}%</span>
              </div>
              <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-zinc-100">
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
    </div>
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
    <div className={cn(momentumCardClass, "h-full p-4")}>
      <h3 className="text-sm font-semibold text-zinc-900">Momentum Score (30D)</h3>
      <p className="mt-0.5 text-[11px] text-zinc-500">Velocity momentum comparison.</p>
      <ul className="mt-4 space-y-3.5">
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
              <div className="flex items-center gap-2 text-xs">
                <span className="w-[38%] min-w-0 truncate font-medium text-zinc-800">
                  {isTarget ? "You" : e.name}
                </span>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-zinc-100">
                    <div
                      className={cn("h-full rounded-full", barColor)}
                      style={{ width: `${Math.max(widthPct, score > 0 ? 6 : 0)}%` }}
                    />
                  </div>
                  <span
                    className={cn(
                      "w-8 shrink-0 rounded px-1.5 py-0.5 text-center text-[10px] font-bold tabular-nums",
                      isTarget
                        ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200"
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
    </div>
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
    <div className="rounded-xl border border-border p-5 dark:border-zinc-800">
      <h3 className="text-sm font-semibold">Days Since Last Review</h3>
      <p className="mt-1 text-xs text-text-muted">
        Fresh reviews signal active engagement. Compare your recency vs competitors.
      </p>
      <ul className="mt-4 space-y-2">
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
                className="flex items-center justify-between rounded-lg px-3 py-2 text-sm bg-surface-subtle dark:bg-zinc-900/50"
              >
                <span className="font-medium">
                  {e.entity_type === "target" ? "You" : e.name.slice(0, 28)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${recencyStatusClass(status)}`}
                >
                  {formatDaysSince(days)}
                </span>
              </li>
            );
          })}
      </ul>

      <div className="mt-5 rounded-lg border border-border p-4 dark:border-zinc-700">
        <p className="text-xs uppercase tracking-wide text-text-muted">Review streak</p>
        {market.reviewStreakWeeks > 0 ? (
          <p className="mt-1 text-lg font-bold text-primary-muted dark:text-emerald-400">
            {market.reviewStreakWeeks} week{market.reviewStreakWeeks === 1 ? "" : "s"} with at least
            one review
          </p>
        ) : market.daysWithoutReview != null && market.daysWithoutReview > 0 ? (
          <p className="mt-1 text-lg font-bold text-red-700 dark:text-red-400">
            No reviews for {market.daysWithoutReview} days
          </p>
        ) : (
          <p className="mt-1 text-sm text-text-muted">Run an audit to calculate streak.</p>
        )}
      </div>
    </div>
  );
}

export function MarketActivityBanner({ market }: { market: MarketInsights }) {
  return (
    <div className={`rounded-xl border p-5 ${marketActivityClass(market.marketActivityLevel)}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">Market Review Activity</p>
      <p className="mt-1 text-2xl font-bold">{market.marketActivityLabel}</p>
      <p className="mt-2 text-sm opacity-90">
        Top {market.entityCount} businesses in your scan received{" "}
        <span className="font-bold">{market.marketReviews30d}</span> new reviews in the last 30 days.
      </p>
      <p className="mt-2 text-xs opacity-75">
        Targets are relative to your market — a competitive market needs a higher weekly pace than a
        quiet one.
      </p>
    </div>
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
      className="block rounded-xl border border-border p-5 transition hover:border-emerald-300 hover:shadow-sm dark:border-zinc-800 dark:hover:border-emerald-700"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-primary" />
          <h2 className="font-semibold">Review Momentum™</h2>
        </div>
        {hasData && momentumScore != null && (
          <span className="text-3xl font-bold tabular-nums text-primary-muted dark:text-emerald-400">
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
