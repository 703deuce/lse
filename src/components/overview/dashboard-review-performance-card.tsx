import Link from "next/link";
import { Star } from "lucide-react";
import type { DashboardReviewPerformance } from "@/lib/overview/dashboard-featured-types";
import { Sparkline } from "@/components/overview/overview-charts";
import { momentumBadgeClass } from "@/lib/reviews/metrics";
import { cn } from "@/lib/utils";

function ShareBar({ label, pct, tone }: { label: string; pct: number; tone: "you" | "them" }) {
  return (
    <div className="flex items-center gap-2 text-[11px]">
      <span className="w-10 shrink-0 text-zinc-500">{label}</span>
      <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-zinc-100">
        <div
          className={cn(
            "h-full rounded-full",
            tone === "you" ? "bg-emerald-500" : "bg-zinc-300"
          )}
          style={{ width: `${Math.max(8, Math.min(100, pct))}%` }}
        />
      </div>
      <span className="w-8 shrink-0 text-right tabular-nums text-zinc-500">{pct}%</span>
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
            "h-3 w-3",
            i < Math.round(stars) ? "fill-amber-400 text-amber-400" : "text-zinc-200"
          )}
        />
      ))}
    </span>
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
    <article className="flex h-full flex-col rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900">Review Performance</h2>
          {data.momentumLabel && (
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-[10px] font-semibold",
                momentumBadgeClass(data.momentumLabel)
              )}
            >
              {data.momentumLabel}
            </span>
          )}
        </div>
        <Link
          href={`/businesses/${businessId}/reviews`}
          className="shrink-0 text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          Open →
        </Link>
      </div>

      <div className="mt-2 grid grid-cols-[1fr_auto] items-end gap-3">
        <div className="flex flex-wrap items-end gap-x-4 gap-y-1">
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-2xl font-bold tabular-nums leading-none text-zinc-900">
              {rating}
            </span>
          </div>
          <p className="text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">{data.newReviews90d}</span> new
            <span className="text-zinc-400"> · 90d</span>
            {data.totalReviews > 0 && (
              <span className="text-zinc-400"> · {data.totalReviews} total</span>
            )}
          </p>
          {data.responseRate != null && (
            <p className="text-xs text-zinc-500">
              <span className="font-medium text-zinc-700">{data.responseRate}%</span> response rate
            </p>
          )}
        </div>
        <Sparkline data={data.trend} color="#059669" width={96} height={36} />
      </div>

      <div className="mt-2.5 space-y-1">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">
          Share of new reviews (30d)
        </p>
        <ShareBar label="You" pct={data.yourSharePct} tone="you" />
        <ShareBar label="Top 3" pct={data.top3SharePct} tone="them" />
      </div>

      {data.latestReview && (
        <div className="mt-2.5 rounded-lg border border-zinc-100 bg-zinc-50/80 p-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2">
              <MiniStars rating={data.latestReview.rating} />
              <span className="truncate text-xs font-semibold text-zinc-900">
                {data.latestReview.reviewerName}
              </span>
            </div>
            <div className="flex shrink-0 items-center gap-2 text-[11px] text-zinc-500">
              {data.latestReview.relativeDate && <span>{data.latestReview.relativeDate}</span>}
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.5 font-medium",
                  data.latestReview.replied
                    ? "bg-emerald-50 text-emerald-700"
                    : "bg-amber-50 text-amber-700"
                )}
              >
                {data.latestReview.replied ? "Replied" : "Unreplied"}
              </span>
            </div>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-zinc-600">
            {data.latestReview.reviewText}
          </p>
        </div>
      )}

      {data.topCompetitor && (
        <p className="mt-2 text-[11px] text-zinc-500">
          Fastest competitor:{" "}
          <span className="font-medium text-zinc-800">{data.topCompetitor.name}</span>
          {data.topCompetitor.rating != null && (
            <span className="text-zinc-400"> · {data.topCompetitor.rating.toFixed(1)}★</span>
          )}
          <span className="text-zinc-400"> · {data.topCompetitor.reviews30d} new (30d)</span>
        </p>
      )}

      {data.weeklyPaceGap != null && data.weeklyPaceGap > 0 && (
        <p className="mt-1.5 text-xs text-zinc-600">
          Need{" "}
          <span className="font-semibold text-emerald-700">
            {data.weeklyPaceGap % 1 === 0 ? data.weeklyPaceGap : data.weeklyPaceGap.toFixed(1)}
          </span>{" "}
          reviews/week to match top competitors
        </p>
      )}

      {!data.hasData && (
        <p className="mt-2 text-xs text-zinc-500">Run Review Momentum to compare competitors.</p>
      )}
    </article>
  );
}
