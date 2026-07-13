"use client";

import { useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import { ReviewDetailDrawer } from "@/components/reviews/review-detail-drawer";
import { ReviewFeedList } from "@/components/reviews/review-feed-list";
import {
  FilterChips,
  KeywordCloud,
  MiniSpark,
  ReviewerAvatar,
  ReviewsPagination,
  RvCard,
  RvSectionTitle,
  type ReviewsTabId,
} from "@/components/reviews/reviews-ui";
import { Sparkline } from "@/components/overview/overview-charts";

const STREAM_PAGE_SIZE = 10;
const LATEST_PREVIEW = 3;

export function ReviewsOverviewTab({
  data,
  onTabChange,
}: {
  data: ReviewsPageData;
  onTabChange?: (tab: ReviewsTabId) => void;
}) {
  const [streamFilter, setStreamFilter] = useState<"all" | "yours" | "competitors" | "5" | "4below" | "unanswered">("all");
  const [streamPage, setStreamPage] = useState(1);
  const [selectedReview, setSelectedReview] = useState<ReviewListItem | null>(null);

  const filtered = useMemo(
    () =>
      data.stream.filter((r) => {
        if (streamFilter === "yours") return r.isTarget;
        if (streamFilter === "competitors") return !r.isTarget;
        if (streamFilter === "5") return r.rating === 5;
        if (streamFilter === "4below") return r.rating != null && r.rating <= 4;
        if (streamFilter === "unanswered") return !r.replied && r.isTarget;
        return true;
      }),
    [data.stream, streamFilter]
  );

  const streamPageRows = useMemo(() => {
    const start = (streamPage - 1) * STREAM_PAGE_SIZE;
    return filtered.slice(start, start + STREAM_PAGE_SIZE);
  }, [filtered, streamPage]);

  return (
    <div className="space-y-5">
      <section>
        <RvSectionTitle title="Review Feed Snapshot" />
        <div className="grid gap-3 lg:grid-cols-2">
          <RvCard>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">
                Your Latest Reviews ({data.yourReviews.length})
              </h3>
              <button
                type="button"
                onClick={() => onTabChange?.("your-reviews")}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                View all {data.yourReviews.length} →
              </button>
            </div>
            <ReviewFeedList
              rows={data.latestTargetReviews.slice(0, LATEST_PREVIEW)}
              onViewReview={setSelectedReview}
              previewLines={3}
            />
          </RvCard>

          <RvCard>
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-zinc-900">Competitor Activity — Last 90 Days</h3>
              <button
                type="button"
                onClick={() => onTabChange?.("competitor-reviews")}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                View all →
              </button>
            </div>
            <div className="space-y-4">
              {data.competitorActivity.length === 0 ? (
                <p className="text-sm text-zinc-500">No competitor data yet.</p>
              ) : (
                data.competitorActivity.map((c) => (
                  <div key={c.id} className="flex items-center gap-3">
                    <ReviewerAvatar name={c.name} />
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-zinc-900">{c.name}</p>
                      <p className="text-xs text-zinc-500">
                        {c.rating?.toFixed(1) ?? "—"} ★ · {c.newReviews90d} new reviews
                      </p>
                    </div>
                    <MiniSpark data={c.spark} />
                    <button
                      type="button"
                      onClick={() => onTabChange?.("competitor-reviews")}
                      className="shrink-0 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                    >
                      View Reviews
                    </button>
                  </div>
                ))
              )}
            </div>
          </RvCard>
        </div>
      </section>

      <section>
        <RvSectionTitle title="Review Insights" />
        <div className="grid gap-3 lg:grid-cols-3">
          <KeywordCloud
            items={data.sentiment.yours.themes.map((t) => ({ keyword: t.label, count: t.reviewCount })).slice(0, 6)}
            title="Top Themes in Your Reviews"
          />
          <KeywordCloud
            items={data.competitorWinningKeywords.slice(0, 6)}
            title="Themes Competitors Get Praised For"
          />
          <RvCard>
            <h3 className="text-sm font-semibold text-zinc-900">Fastest-Growing Competitor</h3>
            {data.fastestGrowingCompetitor ? (
              <div className="mt-3">
                <p className="text-lg font-semibold text-zinc-900">{data.fastestGrowingCompetitor.name}</p>
                <p className="text-sm text-zinc-500">{data.fastestGrowingCompetitor.rating?.toFixed(1) ?? "—"} ★ rating</p>
                <p className="mt-2 text-sm font-medium text-emerald-600">
                  +{data.fastestGrowingCompetitor.delta} reviews vs prior 90 days
                </p>
                <div className="mt-3">
                  <Sparkline data={data.fastestGrowingCompetitor.delta > 0 ? [2, 4, 5, 7, 9, 11, data.fastestGrowingCompetitor.delta] : [0, 0, 0, 0]} color="#059669" width={140} height={36} />
                </div>
              </div>
            ) : (
              <p className="mt-3 text-sm text-zinc-500">Run Review Momentum to compare competitors.</p>
            )}
          </RvCard>
        </div>
      </section>

      <RvCard>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-sm font-semibold text-zinc-900">
            Recent Review Stream ({filtered.length} in last 90 days)
          </h3>
          <div className="flex flex-wrap items-center gap-3">
            <FilterChips
              value={streamFilter}
              onChange={(v) => {
                setStreamFilter(v);
                setStreamPage(1);
              }}
              options={[
                { id: "all", label: "All" },
                { id: "yours", label: "Yours" },
                { id: "competitors", label: "Competitors" },
                { id: "5", label: "5★" },
                { id: "4below", label: "4★ & below" },
                { id: "unanswered", label: "Unanswered" },
              ]}
            />
            <button type="button" className="inline-flex items-center gap-1 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-600">
              Last 90 days
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
        <ReviewFeedList rows={streamPageRows} onViewReview={setSelectedReview} showBusiness previewLines={3} />
        <ReviewsPagination
          page={streamPage}
          pageSize={STREAM_PAGE_SIZE}
          total={filtered.length}
          onPageChange={setStreamPage}
        />
      </RvCard>

      <ReviewDetailDrawer review={selectedReview} onClose={() => setSelectedReview(null)} />
    </div>
  );
}
