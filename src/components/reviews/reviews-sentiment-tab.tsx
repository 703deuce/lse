"use client";

import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ChevronDown, ChevronRight, TrendingUp } from "lucide-react";
import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import type { ThemeDetail, ThemeReviewRef } from "@/lib/reviews/review-themes";
import { ReviewDetailDrawer } from "@/components/reviews/review-detail-drawer";
import { HighlightedReviewText } from "@/components/reviews/highlighted-review-text";
import { ReviewerAvatar, RvCard, StarRating } from "@/components/reviews/reviews-ui";
import { dashboardCardTitle, dashboardMicro } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

function formatPercentTooltip(value: unknown) {
  const numberValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value)
        : 0;

  return `${Number.isFinite(numberValue) ? numberValue : 0}%`;
}

function themeRefToListItem(ref: ThemeReviewRef, lookup: Map<string, ReviewListItem>): ReviewListItem {
  const found = lookup.get(ref.id);
  if (found) return found;
  return {
    id: ref.id,
    reviewerName: ref.reviewerName,
    rating: ref.rating,
    reviewText: ref.reviewText,
    reviewDate: ref.reviewDate,
    relativeDate: null,
    source: "google",
    tags: [],
    replied: false,
    ownerResponseText: null,
    isTarget: ref.isTarget,
    businessName: ref.businessName,
    competitorId: null,
    daysWaiting: null,
    urgency: null,
  };
}

function ThemeReviewCard({
  review,
  onOpen,
}: {
  review: ThemeReviewRef;
  onOpen: () => void;
}) {
  const dateLabel = review.reviewDate
    ? new Date(review.reviewDate).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;

  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5 text-left transition-colors hover:border-emerald-200 hover:bg-emerald-50/30"
    >
      <div className="flex items-start gap-3">
        <ReviewerAvatar name={review.reviewerName} size="sm" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-medium text-zinc-900">{review.reviewerName}</span>
            <StarRating rating={review.rating} />
            {dateLabel && <span className="text-xs text-zinc-500">{dateLabel}</span>}
          </div>
          <HighlightedReviewText
            text={review.reviewText}
            phrases={review.matchedPhrases}
            clamp={3}
            className="mt-1.5"
          />
          <span className="mt-2 inline-block text-xs font-medium text-emerald-600">Read full review →</span>
        </div>
      </div>
    </button>
  );
}

function ThemeDetailPanel({
  theme,
  reviewLookup,
  defaultOpen = false,
  onOpenReview,
}: {
  theme: ThemeDetail;
  reviewLookup: Map<string, ReviewListItem>;
  defaultOpen?: boolean;
  onOpenReview: (review: ReviewListItem, highlightPhrases: string[]) => void;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-lg border border-zinc-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-2 px-3.5 py-2.5 text-left"
      >
        <div className="min-w-0">
          <p className="font-semibold text-zinc-900">{theme.label}</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            {theme.reviewCount} review{theme.reviewCount === 1 ? "" : "s"} · {theme.pct}% of total
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">
            {theme.reviewCount}
          </span>
          {open ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
        </div>
      </button>

      {open && (
        <div className="border-t border-zinc-100 px-3.5 pb-3 pt-2.5">
          {theme.matchedPhrases.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {theme.matchedPhrases.map((phrase) => (
                <span
                  key={phrase}
                  className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900"
                >
                  “{phrase}”
                </span>
              ))}
            </div>
          )}
          <div className="space-y-2">
            {theme.reviews.map((review) => (
              <ThemeReviewCard
                key={review.id}
                review={review}
                onOpen={() => onOpenReview(themeRefToListItem(review, reviewLookup), review.matchedPhrases)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function ReviewsSentimentTab({ data }: { data: ReviewsPageData }) {
  const { sentiment } = data;
  const entitiesWithReviews = sentiment.entities.filter((e) => e.reviewCount > 0);
  const [entityId, setEntityId] = useState(entitiesWithReviews[0]?.id ?? "target");
  const [selectedReview, setSelectedReview] = useState<ReviewListItem | null>(null);
  const [highlightPhrases, setHighlightPhrases] = useState<string[]>([]);

  const openReview = (review: ReviewListItem, phrases: string[] = []) => {
    setSelectedReview(review);
    setHighlightPhrases(phrases);
  };

  const closeReview = () => {
    setSelectedReview(null);
    setHighlightPhrases([]);
  };

  const reviewLookup = useMemo(() => {
    const map = new Map<string, ReviewListItem>();
    for (const r of [...data.yourReviews, ...data.competitorReviews]) {
      map.set(r.id, r);
    }
    return map;
  }, [data.yourReviews, data.competitorReviews]);

  const activeEntity = sentiment.entities.find((e) => e.id === entityId) ?? entitiesWithReviews[0];

  const comparisonChart = useMemo(() => {
    return sentiment.themeComparison.map((row) => ({
      theme: row.label,
      you: row.yoursPct,
      competitors: row.competitorAvgPct,
    }));
  }, [sentiment.themeComparison]);

  if (!activeEntity) {
    return (
      <RvCard>
        <p className="text-sm text-zinc-500">Run Review Momentum to sync reviews and detect themes.</p>
      </RvCard>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-4">
      <div className="space-y-4 xl:col-span-3">
        <RvCard>
          <h3 className={dashboardCardTitle}>Theme Comparison — You vs Competitors</h3>
          <p className={`mt-0.5 ${dashboardMicro}`}>
            % of reviews in the last 90 days that mention each theme organically.
          </p>
          <div className="mt-3 h-56">
            {comparisonChart.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={comparisonChart} layout="vertical" margin={{ left: 4, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" horizontal={false} />
                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 10 }} unit="%" />
                  <YAxis type="category" dataKey="theme" width={130} tick={{ fontSize: 10 }} />
                  <Tooltip formatter={formatPercentTooltip} />
                  <Legend />
                  <Bar dataKey="you" name="You" fill="#059669" radius={[0, 4, 4, 0]} />
                  <Bar dataKey="competitors" name="Competitor avg" fill="#94a3b8" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <p className={dashboardMicro}>Theme comparison will appear as reviews sync.</p>
            )}
          </div>
        </RvCard>

        <RvCard>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className={dashboardCardTitle}>Theme Breakdown by Business</h3>
              <p className={`mt-0.5 ${dashboardMicro}`}>
                Expand any theme to see the reviews it came from.
              </p>
            </div>
          </div>

          <div className="mb-3 flex flex-wrap gap-1.5">
            {entitiesWithReviews.map((entity) => (
              <button
                key={entity.id}
                type="button"
                onClick={() => setEntityId(entity.id)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-[12px] font-medium transition-colors",
                  entityId === entity.id
                    ? "bg-emerald-600 text-white"
                    : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200"
                )}
              >
                {entity.isTarget ? "You" : entity.label}
                <span className="ml-1.5 opacity-80">({entity.themeDetails.length} themes)</span>
              </button>
            ))}
          </div>

          <div className="mb-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {activeEntity.themes.map((theme) => (
              <div key={theme.themeId} className="rounded-lg border border-zinc-100 bg-zinc-50/40 px-3.5 py-2">
                <p className="text-[13px] font-medium text-zinc-900">{theme.label}</p>
                <p className={`mt-0.5 ${dashboardMicro}`}>
                  {theme.reviewCount} reviews · {theme.pct}%
                </p>
              </div>
            ))}
          </div>

          {activeEntity.themeDetails.length === 0 ? (
            <p className="text-sm text-zinc-500">No themes detected in these reviews yet.</p>
          ) : (
            <div className="space-y-2">
              {activeEntity.themeDetails.map((theme, i) => (
                <ThemeDetailPanel
                  key={theme.themeId}
                  theme={theme}
                  reviewLookup={reviewLookup}
                  defaultOpen={i === 0}
                  onOpenReview={openReview}
                />
              ))}
            </div>
          )}
        </RvCard>

        <RvCard>
          <h3 className={dashboardCardTitle}>All Themes — Side by Side</h3>
          <div className="mt-3 overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead>
                <tr className="border-b border-zinc-100 text-[10px] font-semibold uppercase text-zinc-500">
                  <th className="pb-2 pr-2.5">Theme</th>
                  <th className="pb-2 pr-2.5">You</th>
                  <th className="pb-2 pr-2.5">Competitor avg</th>
                  <th className="pb-2">Strongest at</th>
                </tr>
              </thead>
              <tbody>
                {sentiment.themeComparison.map((row) => (
                  <tr key={row.themeId} className="border-b border-zinc-50">
                    <td className="py-2 pr-2.5 font-medium text-zinc-900">{row.label}</td>
                    <td className="py-2 pr-2.5">
                      {row.yours} reviews <span className="text-zinc-500">({row.yoursPct}%)</span>
                    </td>
                    <td className="py-2 pr-2.5">
                      {row.competitorAvg} avg <span className="text-zinc-500">({row.competitorAvgPct}%)</span>
                    </td>
                    <td className="py-2 text-zinc-600">
                      {row.topCompetitor ? `${row.topCompetitor} (${row.topCompetitorPct}%)` : row.yours > 0 ? "You" : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RvCard>
      </div>

      <div className="space-y-3">
        <RvCard>
          <div className="mb-2.5 flex items-center gap-2">
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            <h3 className={dashboardCardTitle}>Theme Insights</h3>
          </div>
          <p className={`mb-2.5 ${dashboardMicro}`}>
            Themes are detected from real review language. Google prohibits asking customers to mention specific phrases.
          </p>
          <div className="space-y-2">
            {sentiment.insights.map((insight) => (
              <div key={insight.id} className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-2.5">
                <p className="text-[13px] font-medium text-zinc-900">{insight.title}</p>
                <p className={`mt-0.5 ${dashboardMicro}`}>{insight.description}</p>
              </div>
            ))}
          </div>
        </RvCard>

        <RvCard className="border-amber-100 bg-amber-50/40">
          <h3 className={dashboardCardTitle}>Themes to Strengthen</h3>
          <p className={`mt-1 ${dashboardMicro}`}>
            Where competitors earn more organic praise — improve the service, not review wording.
          </p>
          <ul className="mt-2 space-y-1.5 text-[13px]">
            {sentiment.themeComparison
              .filter((row) => row.competitorAvgPct > row.yoursPct)
              .slice(0, 5)
              .map((row) => (
                <li key={row.themeId} className="flex items-center justify-between gap-2">
                  <span className="text-zinc-700">{row.label}</span>
                  <span className="shrink-0 text-xs font-medium text-amber-800">
                    +{row.competitorAvgPct - row.yoursPct}% vs you
                  </span>
                </li>
              ))}
          </ul>
        </RvCard>

        <RvCard>
          <h3 className={dashboardCardTitle}>Sentiment Snapshot</h3>
          <p className={`mt-0.5 ${dashboardMicro}`}>Secondary view — themes above are the primary signal.</p>
          <dl className="mt-2 space-y-1.5 text-[13px]">
            <div className="flex justify-between rounded-lg bg-emerald-50/50 px-3.5 py-2">
              <dt className="font-medium text-zinc-900">You</dt>
              <dd className="text-emerald-700">{sentiment.yours.sentiment.positivePct}% positive</dd>
            </div>
            {sentiment.competitors
              .filter((c) => c.reviewCount > 0)
              .map((c) => (
                <div key={c.id} className="flex justify-between px-3 py-1">
                  <dt className="truncate text-zinc-600">{c.name}</dt>
                  <dd className="shrink-0 font-medium">{c.sentiment.positivePct}%</dd>
                </div>
              ))}
          </dl>
        </RvCard>
      </div>

      <ReviewDetailDrawer
        review={selectedReview}
        highlightPhrases={highlightPhrases}
        onClose={closeReview}
      />
    </div>
  );
}
