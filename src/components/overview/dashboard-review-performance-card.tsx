import Link from "next/link";
import { ArrowRight, Star } from "lucide-react";
import type { DashboardReviewPerformance } from "@/lib/overview/load-dashboard-featured";
import { Sparkline } from "@/components/overview/overview-charts";
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
    <article className="flex h-full flex-col rounded-xl border border-zinc-200/80 bg-white p-4 shadow-[0_1px_3px_rgba(0,0,0,0.04)]">
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold text-zinc-900">Review Performance</h2>
        <Link
          href={`/businesses/${businessId}/reviews`}
          className="text-xs font-medium text-emerald-600 hover:text-emerald-700"
        >
          Open →
        </Link>
      </div>

      <div className="mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            <span className="text-2xl font-bold tabular-nums leading-none text-zinc-900">
              {rating}
            </span>
          </div>
          <p className="mt-1 text-xs text-zinc-500">
            <span className="font-medium text-zinc-700">{data.newReviews90d}</span> new reviews
            <span className="text-zinc-400"> · Last 90 days</span>
          </p>
        </div>
        <Sparkline data={data.trend} color="#059669" width={88} height={32} />
      </div>

      <div className="mt-3 space-y-1.5">
        <p className="text-[10px] font-medium uppercase tracking-wide text-zinc-400">Competitors</p>
        <ShareBar label="You" pct={data.yourSharePct} tone="you" />
        <ShareBar label="Top 3" pct={data.top3SharePct} tone="them" />
      </div>

      {data.weeklyPaceGap != null && data.weeklyPaceGap > 0 && (
        <p className="mt-2.5 text-xs text-zinc-600">
          Need{" "}
          <span className="font-semibold text-emerald-700">
            {data.weeklyPaceGap % 1 === 0 ? data.weeklyPaceGap : data.weeklyPaceGap.toFixed(1)}
          </span>{" "}
          reviews/week
        </p>
      )}

      {!data.hasData && (
        <p className="mt-2 text-xs text-zinc-500">Run Review Momentum to compare competitors.</p>
      )}
    </article>
  );
}
