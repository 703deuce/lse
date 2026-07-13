import Link from "next/link";
import { Star } from "lucide-react";
import type { DashboardLatestReview, DashboardReviewPerformance } from "@/lib/overview/dashboard-featured-types";
import { Sparkline } from "@/components/overview/overview-charts";
import {
  dashboardAccentLink,
  dashboardBadge,
  dashboardBody,
  dashboardCardClass,
  dashboardCardMeta,
  dashboardCardTitle,
  dashboardMicro,
  dashboardSectionLabel,
} from "@/components/overview/dashboard-ui";
import { momentumBadgeClass } from "@/lib/reviews/metrics";
import { cn } from "@/lib/utils";

function ShareBar({ label, pct, tone }: { label: string; pct: number; tone: "you" | "them" }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-9 shrink-0 font-medium text-zinc-500">{label}</span>
      <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "you" ? "bg-emerald-500" : "bg-zinc-300"
          )}
          style={{ width: `${Math.max(8, Math.min(100, pct))}%` }}
        />
      </div>
      <span className="w-7 shrink-0 text-right font-medium tabular-nums text-zinc-500">
        {pct}%
      </span>
    </div>
  );
}

function MiniStars({ rating }: { rating: number | null }) {
  const stars = rating ?? 0;
  return (
    <span className="inline-flex gap-px">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={cn(
            "h-2.5 w-2.5",
            i < Math.round(stars) ? "fill-amber-400 text-amber-400" : "text-zinc-200"
          )}
        />
      ))}
    </span>
  );
}

function ReviewSnippet({ review }: { review: DashboardLatestReview }) {
  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 px-2.5 py-2">
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <MiniStars rating={review.rating} />
          <span className="truncate text-[12px] font-semibold text-zinc-900">
            {review.reviewerName}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-zinc-500">
          {review.relativeDate && <span className="tabular-nums">{review.relativeDate}</span>}
          <span
            className={cn(
              dashboardBadge,
              review.replied
                ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                : "bg-amber-50 text-amber-700 ring-1 ring-amber-100"
            )}
          >
            {review.replied ? "Replied" : "Unreplied"}
          </span>
        </div>
      </div>
      <p className={cn(dashboardMicro, "mt-1 line-clamp-2 text-zinc-600")}>{review.reviewText}</p>
    </div>
  );
}

export function DashboardReviewPerformanceCard({
  businessId,
  data,
}: {
  businessId: string;
  data: DashboardReviewPerformance;
}) {
  const rating = data.rating != null ? data.rating.toFixed(1) : "—";

  return (
    <article className={dashboardCardClass("flex h-full flex-col")}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={dashboardCardTitle}>Review Performance</h2>
          {data.momentumLabel && (
            <span className={cn(dashboardBadge, momentumBadgeClass(data.momentumLabel))}>
              {data.momentumLabel}
            </span>
          )}
        </div>
        <Link href={`/businesses/${businessId}/reviews`} className={dashboardAccentLink}>
          Open
        </Link>
      </div>

      <div className="mt-2.5 grid grid-cols-[1fr_auto] items-end gap-3">
        <div className="space-y-1">
          <div className="flex items-baseline gap-1.5">
            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
            <span className="text-base font-semibold tabular-nums tracking-tight text-zinc-900">
              {rating}
            </span>
          </div>
          <p className={dashboardMicro}>
            <span className="font-semibold text-zinc-700">{data.newReviews90d}</span> new · 90d
            {data.totalReviews > 0 && (
              <span className="text-zinc-400"> · {data.totalReviews} total</span>
            )}
            {data.responseRate != null && (
              <span className="text-zinc-400"> · {data.responseRate}% response rate</span>
            )}
          </p>
        </div>
        <Sparkline data={data.trend} color="#059669" width={88} height={32} />
      </div>

      <div className="mt-3 space-y-1.5">
        <p className={dashboardSectionLabel}>Share of new reviews (30d)</p>
        <ShareBar label="You" pct={data.yourSharePct} tone="you" />
        <ShareBar label="Top 3" pct={data.top3SharePct} tone="them" />
      </div>

      {data.latestReviews.length > 0 && (
        <div className="mt-3 space-y-1.5">
          <p className={dashboardSectionLabel}>Recent reviews</p>
          {data.latestReviews.map((review, index) => (
            <ReviewSnippet key={`${review.reviewerName}-${index}`} review={review} />
          ))}
        </div>
      )}

      {(data.topCompetitor || (data.weeklyPaceGap != null && data.weeklyPaceGap > 0)) && (
        <div className="mt-3 border-t border-zinc-100 pt-2.5">
          {data.topCompetitor && (
            <p className={dashboardCardMeta}>
              Fastest competitor:{" "}
              <span className="font-medium text-zinc-700">{data.topCompetitor.name}</span>
              {data.topCompetitor.rating != null && (
                <span> · {data.topCompetitor.rating.toFixed(1)}★</span>
              )}
              <span> · {data.topCompetitor.reviews30d} new (30d)</span>
            </p>
          )}
          {data.weeklyPaceGap != null && data.weeklyPaceGap > 0 && (
            <p className={cn(dashboardCardMeta, "mt-0.5")}>
              Need{" "}
              <span className="font-semibold text-emerald-700">
                {data.weeklyPaceGap % 1 === 0 ? data.weeklyPaceGap : data.weeklyPaceGap.toFixed(1)}
              </span>{" "}
              reviews/week to match leaders
            </p>
          )}
        </div>
      )}

      {!data.hasData && (
        <p className={cn(dashboardBody, "mt-3 text-zinc-500")}>
          Run Review Momentum to compare competitors.
        </p>
      )}
    </article>
  );
}
