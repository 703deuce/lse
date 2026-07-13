"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock, Search } from "lucide-react";
import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import { ReviewDetailDrawer } from "@/components/reviews/review-detail-drawer";
import { ReviewFeedList } from "@/components/reviews/review-feed-list";
import {
  DeltaText,
  ReviewerAvatar,
  ReviewsPagination,
  RvCard,
  RvSectionTitle,
  SourceIcon,
  StarRating,
} from "@/components/reviews/reviews-ui";
import { DonutScore } from "@/components/overview/overview-charts";
import { dashboardControl, dashboardMicro } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 8;

export function ReviewsYourTab({ data }: { data: ReviewsPageData }) {
  const [statusFilter, setStatusFilter] = useState<"all" | "replied" | "unreplied">("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedReview, setSelectedReview] = useState<ReviewListItem | null>(null);

  const filtered = useMemo(() => {
    return data.yourReviews.filter((r) => {
      if (statusFilter === "replied" && !r.replied) return false;
      if (statusFilter === "unreplied" && r.replied) return false;
      if (search && !(r.reviewText ?? "").toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [data.yourReviews, statusFilter, search]);

  useEffect(() => {
    setPage(1);
  }, [statusFilter, search]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * PAGE_SIZE;
    return filtered.slice(start, start + PAGE_SIZE);
  }, [filtered, page]);

  const newest = data.yourReviews[0];

  return (
    <div className="space-y-4">
      <section>
        <RvSectionTitle title={`Your Review Insights (${data.yourReviews.length} reviews, last 90 days)`} />
        <div className="grid gap-2.5 md:grid-cols-2 xl:grid-cols-4">
          <RvCard className="!p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Response Rate</p>
            <div className="mt-1 flex items-end justify-between gap-2">
              <div>
                <p className="text-base font-bold leading-none text-zinc-900">{data.kpis.responseRate}%</p>
                <div className="mt-1">
                  <DeltaText value={data.kpis.responseRateDelta} suffix="% vs prior 90 days" />
                </div>
              </div>
              <DonutScore score={data.kpis.responseRate} size={40} strokeWidth={4} />
            </div>
          </RvCard>
          <RvCard className="!p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Avg Reply Time</p>
            <p className="mt-1 text-base font-bold leading-none text-zinc-900">4h 32m</p>
            <p className="mt-0.5 text-[11px] font-medium text-emerald-600">↓ 1h 12m vs prior period</p>
            <Clock className="mt-1.5 h-4 w-4 text-emerald-500" />
          </RvCard>
          <RvCard className="!p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Newest Review</p>
            {newest ? (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <ReviewerAvatar name={newest.reviewerName} size="sm" />
                  <div>
                    <StarRating rating={newest.rating} />
                    <p className="text-[11px] text-zinc-500">{newest.relativeDate}</p>
                  </div>
                </div>
                <p className="mt-1.5 line-clamp-3 text-[13px] leading-snug text-zinc-600">{newest.reviewText}</p>
                <button
                  type="button"
                  onClick={() => setSelectedReview(newest)}
                  className="mt-1.5 text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Read full review →
                </button>
              </div>
            ) : (
              <p className={`mt-2 ${dashboardMicro}`}>No reviews yet.</p>
            )}
          </RvCard>
          <RvCard className="!p-3">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Review Sources (90D)</p>
            <div className="mt-2 space-y-2">
              {[
                { source: "google" as const, count: Math.round(data.kpis.newReviews90d * 0.69), pct: 69 },
                { source: "facebook" as const, count: Math.round(data.kpis.newReviews90d * 0.19), pct: 19 },
                { source: "yelp" as const, count: Math.round(data.kpis.newReviews90d * 0.12), pct: 12 },
              ].map((s) => (
                <div key={s.source} className="flex items-center justify-between text-[13px]">
                  <div className="flex items-center gap-2">
                    <SourceIcon source={s.source} />
                    <span className="capitalize text-zinc-700">{s.source}</span>
                  </div>
                  <span className="text-zinc-500">
                    {s.count} · {s.pct}%
                  </span>
                </div>
              ))}
            </div>
          </RvCard>
        </div>
      </section>

      <RvCard>
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              placeholder="Search reviews..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(dashboardControl, "w-full py-0 pl-8 pr-3 text-[13px]")}
            />
          </div>
          <div className="flex rounded-lg border border-zinc-200 bg-zinc-50 p-0.5">
            {(
              [
                ["all", `All (${data.yourReviews.length})`],
                ["replied", "Replied"],
                ["unreplied", "Unreplied"],
              ] as const
            ).map(([f, label]) => (
              <button
                key={f}
                type="button"
                onClick={() => setStatusFilter(f)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors",
                  statusFilter === f ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className={`mb-3 ${dashboardMicro}`}>
          {filtered.length} review{filtered.length === 1 ? "" : "s"} — full text shown below. Click any review to open it in a reader panel.
        </p>

        <ReviewFeedList rows={pageRows} onViewReview={setSelectedReview} previewLines={0} />
        <ReviewsPagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </RvCard>

      <ReviewDetailDrawer review={selectedReview} onClose={() => setSelectedReview(null)} />
    </div>
  );
}
