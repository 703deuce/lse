"use client";

import { useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import { ReviewDetailDrawer } from "@/components/reviews/review-detail-drawer";
import { ReviewFeedList } from "@/components/reviews/review-feed-list";
import {
  DeltaText,
  ReviewerAvatar,
  RvCard,
  SourceIcon,
  StarRating,
} from "@/components/reviews/reviews-ui";
import {
  FilterBar,
  PageSection,
  btnSecondary,
  inputClass,
  microClass,
} from "@/components/ui/design-system";
import { cn } from "@/lib/utils";

const INITIAL_REVIEW_COUNT = 5;
const REVIEW_INCREMENT = 5;

export function ReviewsYourTab({ data }: { data: ReviewsPageData }) {
  const [statusFilter, setStatusFilter] = useState<"all" | "replied" | "unreplied">("all");
  const [search, setSearch] = useState("");
  const [visibleCount, setVisibleCount] = useState(INITIAL_REVIEW_COUNT);
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
    setVisibleCount(INITIAL_REVIEW_COUNT);
  }, [statusFilter, search]);

  const visibleRows = useMemo(() => filtered.slice(0, visibleCount), [filtered, visibleCount]);
  const newest = data.yourReviews[0];

  return (
    <div className="space-y-8">
      <PageSection
        title="Latest reviews"
        description="Read and reply to recent customer feedback."
      >
        <FilterBar>
          <div className="relative min-w-[180px] flex-1">
            <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              placeholder="Search reviews..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className={cn(inputClass, "h-9 py-0 pl-8 pr-3")}
            />
          </div>
          <div className="flex rounded-md border border-zinc-200 bg-zinc-50 p-0.5">
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
                  "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                  statusFilter === f ? "bg-white text-zinc-900 shadow-sm" : "text-zinc-600 hover:text-zinc-900"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </FilterBar>

        <RvCard padding={false} className="overflow-hidden !p-0">
          <div className="px-4 pt-3">
            <p className={microClass}>
              Showing {Math.min(visibleCount, filtered.length)} of {filtered.length} review
              {filtered.length === 1 ? "" : "s"}
            </p>
          </div>
          <ReviewFeedList rows={visibleRows} onViewReview={setSelectedReview} previewLines={3} />
          {visibleCount < filtered.length && (
            <div className="border-t border-zinc-100 px-4 py-3 text-center">
              <button
                type="button"
                onClick={() => setVisibleCount((count) => count + REVIEW_INCREMENT)}
                className={cn(btnSecondary, "h-8 px-3 text-xs")}
              >
                More reviews
              </button>
            </div>
          )}
        </RvCard>
      </PageSection>

      <PageSection
        title="Insights"
        description="Secondary context — response health and where reviews come from."
      >
        <div className="grid gap-3 md:grid-cols-3">
          <RvCard>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Response rate
            </p>
            <p className="mt-1.5 text-xl font-semibold tabular-nums text-zinc-900">
              {data.kpis.responseRate}%
            </p>
            <div className="mt-1">
              <DeltaText value={data.kpis.responseRateDelta} suffix="% vs prior 90 days" />
            </div>
          </RvCard>
          <RvCard>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Newest review
            </p>
            {newest ? (
              <div className="mt-2">
                <div className="flex items-center gap-2">
                  <ReviewerAvatar name={newest.reviewerName} size="sm" />
                  <div>
                    <StarRating rating={newest.rating} />
                    <p className="text-xs text-zinc-500">{newest.relativeDate}</p>
                  </div>
                </div>
                <p className="mt-2 line-clamp-2 text-sm leading-snug text-zinc-600">
                  {newest.reviewText}
                </p>
                <button
                  type="button"
                  onClick={() => setSelectedReview(newest)}
                  className="mt-2 text-xs font-semibold text-[#137752] hover:underline"
                >
                  Read full review →
                </button>
              </div>
            ) : (
              <p className={cn("mt-2", microClass)}>No reviews yet.</p>
            )}
          </RvCard>
          <RvCard>
            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-zinc-500">
              Sources (90d)
            </p>
            <div className="mt-2 space-y-2">
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
                  <span className="tabular-nums text-zinc-500">
                    {s.count} · {s.pct}%
                  </span>
                </div>
              ))}
            </div>
          </RvCard>
        </div>
      </PageSection>

      <ReviewDetailDrawer review={selectedReview} onClose={() => setSelectedReview(null)} />
    </div>
  );
}
