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
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

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
    <div className="space-y-5">
      <section>
        <RvSectionTitle title={`Your Review Insights (${data.yourReviews.length} reviews, last 90 days)`} />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <RvCard className="!px-3.5 !py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Response Rate</p>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <div>
                <p className="text-2xl font-bold leading-none text-zinc-900">{data.kpis.responseRate}%</p>
                <div className="mt-1">
                  <DeltaText value={data.kpis.responseRateDelta} suffix="% vs prior 90 days" />
                </div>
              </div>
              <DonutScore score={data.kpis.responseRate} size={44} strokeWidth={5} />
            </div>
          </RvCard>
          <RvCard className="!px-3.5 !py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Avg Reply Time</p>
            <p className="mt-1.5 text-2xl font-bold leading-none text-zinc-900">4h 32m</p>
            <p className="mt-1 text-xs font-medium text-emerald-600">↓ 1h 12m vs prior period</p>
            <Clock className="mt-2 h-5 w-5 text-emerald-500" />
          </RvCard>
          <RvCard className="!px-3.5 !py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Newest Review</p>
            {newest ? (
              <div className="mt-3">
                <div className="flex items-center gap-2">
                  <ReviewerAvatar name={newest.reviewerName} size="sm" />
                  <div>
                    <StarRating rating={newest.rating} />
                    <p className="text-[11px] text-zinc-500">{newest.relativeDate}</p>
                  </div>
                </div>
                <p className="mt-2 line-clamp-4 text-sm leading-relaxed text-zinc-600">{newest.reviewText}</p>
                <button
                  type="button"
                  onClick={() => setSelectedReview(newest)}
                  className="mt-2 text-sm font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Read full review →
                </button>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">No reviews yet.</p>
            )}
          </RvCard>
          <RvCard className="!px-3.5 !py-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-500">Review Sources (90D)</p>
            <div className="mt-3 space-y-2.5">
              {[
                { source: "google" as const, count: Math.round(data.kpis.newReviews90d * 0.69), pct: 69 },
                { source: "facebook" as const, count: Math.round(data.kpis.newReviews90d * 0.19), pct: 19 },
                { source: "yelp" as const, count: Math.round(data.kpis.newReviews90d * 0.12), pct: 12 },
              ].map((s) => (
                <div key={s.source} className="flex items-center justify-between text-sm">
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
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              placeholder="Search reviews..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-lg border border-zinc-200 py-2 pl-9 pr-3 text-sm"
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
                  "rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                  statusFilter === f ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <p className="mb-4 text-sm text-zinc-600">
          {filtered.length} review{filtered.length === 1 ? "" : "s"} — full text shown below. Click any review to open it in a reader panel.
        </p>

        <ReviewFeedList rows={pageRows} onViewReview={setSelectedReview} previewLines={0} />
        <ReviewsPagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPageChange={setPage} />
      </RvCard>

      <ReviewDetailDrawer review={selectedReview} onClose={() => setSelectedReview(null)} />
    </div>
  );
}
