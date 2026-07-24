"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Calendar,
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  Star,
} from "lucide-react";
import { RepAreaTrendChart } from "@/components/reputation/rep-charts";
import { ReputationSyncButton } from "@/components/reputation/reputation-sync-button";
import { MockMetricCard, MockPageHeader, mock } from "@/components/mockup/ui";
import { cn } from "@/lib/utils";
import type { ReviewOverviewData } from "@/lib/reviews/review-overview-preview-data";

const GREEN = "#137752";
const BLUE = "#3B82F6";
const GREY_LINE = "#A1A1AA";

function YellowStars({ rating, size = "sm" }: { rating: number; size?: "sm" | "md" }) {
  const full = Math.floor(rating);
  const half = rating - full >= 0.25 && rating - full < 0.75;
  const cls = size === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  return (
    <span className="inline-flex items-center gap-0.5" aria-label={`${rating} stars`}>
      {Array.from({ length: 5 }).map((_, i) => {
        const filled = i < full || (i === full && half);
        return (
          <Star
            key={i}
            className={cn(
              cls,
              filled ? "fill-[#FDB022] text-[#FDB022]" : "fill-zinc-200 text-zinc-200"
            )}
          />
        );
      })}
    </span>
  );
}

function fmtNum(n: number | null | undefined, digits = 0): string {
  if (n == null || Number.isNaN(n)) return "—";
  return digits > 0 ? n.toFixed(digits) : String(n);
}

function nextActionHref(businessId: string, ctaLabel: string): string {
  const label = ctaLabel.toLowerCase();
  if (label.includes("respond") || label.includes("unanswered")) {
    return `/businesses/${businessId}/reputation/reviews?tab=unanswered`;
  }
  if (label.includes("request")) {
    return `/businesses/${businessId}/reputation/requests`;
  }
  if (
    label.includes("momentum") ||
    label.includes("action plan") ||
    label.includes("sync") ||
    label.includes("analytics")
  ) {
    return `/businesses/${businessId}/reputation/analytics`;
  }
  if (label.includes("maps") || label.includes("visibility") || label.includes("rank")) {
    return `/businesses/${businessId}/maps`;
  }
  return `/businesses/${businessId}/reputation/reviews`;
}

function deriveSentiment(data: ReviewOverviewData): {
  positive: number;
  neutral: number;
  negative: number;
} {
  const rated = data.recentReviews.filter((r) => r.rating != null);
  if (rated.length > 0) {
    let positive = 0;
    let neutral = 0;
    let negative = 0;
    for (const r of rated) {
      const rating = r.rating as number;
      if (rating >= 4) positive += 1;
      else if (rating >= 3) neutral += 1;
      else negative += 1;
    }
    const total = positive + neutral + negative;
    return {
      positive: Math.round((positive / total) * 100),
      neutral: Math.round((neutral / total) * 100),
      negative: Math.round((negative / total) * 100),
    };
  }

  const of = Math.max(data.answeredOf, 1);
  const negativePct = Math.min(100, Math.round((data.unansweredNegative / of) * 100));
  const positivePct = Math.max(0, 100 - negativePct - 10);
  return {
    positive: positivePct,
    neutral: Math.max(0, 100 - positivePct - negativePct),
    negative: negativePct,
  };
}

function SentimentBars({
  positive,
  neutral,
  negative,
  compact = false,
}: {
  positive: number;
  neutral: number;
  negative: number;
  compact?: boolean;
}) {
  const rows = [
    { label: "Positive", pct: positive, color: GREEN },
    { label: "Neutral", pct: neutral, color: "#FDB022" },
    { label: "Negative", pct: negative, color: "#F04438" },
  ];
  return (
    <div className={cn("space-y-2.5", compact && "space-y-2")}>
      {rows.map((row) => (
        <div key={row.label}>
          <div className="mb-1 flex items-center justify-between gap-2 text-[12px]">
            <span className="font-medium text-[#475467]">{row.label}</span>
            <span className="tabular-nums font-semibold text-[#101828]">{row.pct}%</span>
          </div>
          <div className={cn("overflow-hidden rounded-full bg-[#F2F4F7]", compact ? "h-1.5" : "h-2")}>
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${Math.max(0, Math.min(100, row.pct))}%`, backgroundColor: row.color }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function TaskCheckRow({
  done,
  title,
  body,
  href,
  cta,
}: {
  done?: boolean;
  title: string;
  body?: string;
  href: string;
  cta?: string;
}) {
  return (
    <li className="flex items-start gap-3 border-b border-[#F2F4F7] py-3 last:border-b-0 last:pb-0 first:pt-0">
      <span
        className={cn(
          "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-md border",
          done
            ? "border-[#137752] bg-[#137752] text-white"
            : "border-[#D0D5DD] bg-white text-transparent"
        )}
        aria-hidden
      >
        <Check className="h-3 w-3" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1">
        <p className={cn("text-[13px] font-semibold text-[#101828]", done && "line-through text-[#98A2B3]")}>
          {title}
        </p>
        {body ? <p className="mt-0.5 text-[12px] leading-snug text-[#667085]">{body}</p> : null}
        {cta ? (
          <Link href={href} className={cn(mock.link, "mt-1.5 inline-flex text-[12px]")}>
            {cta} →
          </Link>
        ) : null}
      </div>
    </li>
  );
}

function avatarInitial(name: string): string {
  const part = name.trim().charAt(0);
  return part ? part.toUpperCase() : "?";
}

export function ReviewOverviewDashboard({
  businessId,
  data,
}: {
  businessId: string;
  data: ReviewOverviewData;
}) {
  const [draftStatus, setDraftStatus] = useState<string | null>(null);
  const [draftByReviewId, setDraftByReviewId] = useState<Record<string, string>>({});

  const reviewsHref = `/businesses/${businessId}/reputation/reviews`;
  const unansweredHref = `/businesses/${businessId}/reputation/reviews?tab=unanswered`;
  const requestsHref = `/businesses/${businessId}/reputation/requests`;
  const mapsHref = `/businesses/${businessId}/maps`;
  const actionHref = nextActionHref(businessId, data.nextAction.ctaLabel);
  const sentiment = useMemo(() => deriveSentiment(data), [data]);

  async function generateResponse(reviewId: string, reviewerName: string) {
    setDraftStatus(null);
    try {
      const res = await fetch("/api/reputation/responses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, reviewIds: [reviewId] }),
      });
      const json = (await res.json().catch(() => ({}))) as {
        drafts?: Array<{ draftText?: string; reply?: string }>;
        reply?: string;
      };
      const reply =
        json.drafts?.[0]?.draftText ||
        json.drafts?.[0]?.reply ||
        json.reply ||
        `Hi ${reviewerName.split(" ")[0] || "there"},\n\nThank you for your review. We appreciate your feedback.\n\nBest regards`;
      setDraftByReviewId((prev) => ({ ...prev, [reviewId]: reply }));
      await navigator.clipboard.writeText(reply);
      setDraftStatus("Response generated and copied — paste it in Google to publish");
    } catch {
      setDraftStatus("Could not generate a response right now");
    }
  }

  async function copyResponse(reviewId: string, reviewerName: string) {
    setDraftStatus(null);
    const existing = draftByReviewId[reviewId];
    if (existing) {
      try {
        await navigator.clipboard.writeText(existing);
        setDraftStatus("Response copied — paste it in Google to publish");
      } catch {
        setDraftStatus("Could not copy to clipboard");
      }
      return;
    }
    await generateResponse(reviewId, reviewerName);
  }

  const headerActions = (
    <>
      <span className={cn(mock.btnSecondary, "pointer-events-none h-9 cursor-default gap-2 px-3 text-[13px]")}>
        <Calendar className="h-3.5 w-3.5 text-[#667085]" />
        {data.dateRangeLabel}
      </span>
      <ReputationSyncButton businessId={businessId} label="Refresh" variant="secondary" />
    </>
  );

  if (data.hasMapsData) {
    return (
      <div className={mock.page}>
        <MockPageHeader title="Overview" actions={headerActions} />

        <div className="grid gap-4 lg:grid-cols-2">
          <section className={cn(mock.card, "p-5")}>
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-[#101828]">Reputation Summary</h2>
              <Link href={reviewsHref} className={mock.link}>
                View reviews →
              </Link>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className={mock.label}>Total Reviews</p>
                <p className="mt-1 text-[28px] font-bold tabular-nums leading-none text-[#101828]">
                  {data.totalReviews}
                </p>
                <p className="mt-1.5 text-[12px] font-medium text-[#027A48]">
                  +{data.gained30d} last 30 days
                </p>
              </div>
              <div>
                <p className={mock.label}>Avg Rating</p>
                <div className="mt-1 flex items-end gap-2">
                  <p className="text-[28px] font-bold tabular-nums leading-none text-[#101828]">
                    {fmtNum(data.googleRating, 1)}
                  </p>
                  {data.googleRating != null ? <YellowStars rating={data.googleRating} size="md" /> : null}
                </div>
              </div>
            </div>
            <div className="mt-5 border-t border-[#F2F4F7] pt-4">
              <p className={cn(mock.label, "mb-2.5")}>Sentiment</p>
              <SentimentBars {...sentiment} compact />
            </div>
          </section>

          <section className={cn(mock.card, "p-5")}>
            <div className="mb-4 flex items-start justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-[#101828]">Local Visibility Summary</h2>
              <Link href={mapsHref} className={mock.link}>
                Open Maps →
              </Link>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <p className={mock.label}>Avg Rank</p>
                <p className="mt-1 text-[26px] font-bold tabular-nums leading-none text-[#101828]">
                  {fmtNum(data.mapsAvgRank, 1)}
                </p>
              </div>
              <div>
                <p className={mock.label}>Top 3 %</p>
                <p className="mt-1 text-[26px] font-bold tabular-nums leading-none text-[#101828]">
                  {fmtNum(data.top3VisibilityPct)}%
                </p>
              </div>
              <div>
                <p className={mock.label}>Top 10 %</p>
                <p className="mt-1 text-[26px] font-bold tabular-nums leading-none text-[#101828]">
                  {fmtNum(data.top10VisibilityPct)}%
                </p>
              </div>
            </div>
            {(data.strongestKeyword || data.weakestKeyword) && (
              <div className="mt-5 space-y-2 border-t border-[#F2F4F7] pt-4 text-[13px]">
                {data.strongestKeyword ? (
                  <p className="text-[#475467]">
                    Strongest:{" "}
                    <span className="font-semibold text-[#101828]">{data.strongestKeyword}</span>
                  </p>
                ) : null}
                {data.weakestKeyword ? (
                  <p className="text-[#475467]">
                    Weakest:{" "}
                    <span className="font-semibold text-[#101828]">{data.weakestKeyword}</span>
                  </p>
                ) : null}
              </div>
            )}
          </section>
        </div>

        {data.combinedInsight ? (
          <div className={mock.banner}>
            <p className="text-sm font-medium leading-relaxed text-[#027A48]">{data.combinedInsight}</p>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-5">
          <section className={cn(mock.card, "p-5 xl:col-span-3")}>
            <h2 className="mb-3 text-[16px] font-semibold text-[#101828]">Performance Over Time</h2>
            {data.trendSeries.length > 0 ? (
              <RepAreaTrendChart
                data={data.trendSeries}
                xKey="label"
                height={220}
                series={[
                  { dataKey: "you", name: "You", color: GREEN },
                  { dataKey: "benchmark", name: "Benchmark", color: BLUE, fillOpacity: 0.12 },
                  {
                    dataKey: "competitor",
                    name: "Competitor",
                    color: GREY_LINE,
                    dashed: true,
                    fillOpacity: 0.04,
                  },
                ]}
              />
            ) : (
              <p className="py-12 text-center text-sm text-[#667085]">
                Sync reputation data to plot performance over time.
              </p>
            )}
          </section>

          <section className={cn(mock.card, "p-5 xl:col-span-2")}>
            <h2 className="mb-1 text-[16px] font-semibold text-[#101828]">Priority Tasks</h2>
            <p className="mb-3 text-[12px] text-[#667085]">What to do next across reputation and maps</p>
            <ul>
              <TaskCheckRow
                title={data.nextAction.title}
                body={data.nextAction.body}
                href={actionHref}
                cta={data.nextAction.ctaLabel}
              />
              {data.unansweredTotal > 0 ? (
                <TaskCheckRow
                  title={`Respond to ${data.unansweredTotal} unanswered review${data.unansweredTotal === 1 ? "" : "s"}`}
                  body={
                    data.unansweredNegative > 0
                      ? `${data.unansweredNegative} negative need attention first`
                      : "Keep your reply rate healthy"
                  }
                  href={unansweredHref}
                  cta="Open unanswered"
                />
              ) : null}
              {data.weakestKeyword ? (
                <TaskCheckRow
                  title={`Improve visibility for “${data.weakestKeyword}”`}
                  body={
                    data.mapsBridgeMessage ??
                    "Reviews help, but local map rank still needs work on this keyword."
                  }
                  href={mapsHref}
                  cta="Check Maps"
                />
              ) : (
                <TaskCheckRow
                  title="Review local visibility"
                  body={
                    data.mapsBridgeMessage ??
                    "See where you appear across your service area on Google Maps."
                  }
                  href={mapsHref}
                  cta="Open Maps"
                />
              )}
              <TaskCheckRow
                title="Send review requests"
                body="Keep review momentum with a fresh request batch."
                href={requestsHref}
                cta="Send requests"
              />
            </ul>
          </section>
        </div>
      </div>
    );
  }

  // Layout A — Reputation only
  return (
    <div className={mock.page}>
      <MockPageHeader title="Overview" actions={headerActions} />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <MockMetricCard label="Total Reviews" value={data.totalReviews} />
        <MockMetricCard
          label="Average Rating"
          value={
            <span className="inline-flex items-end gap-2">
              <span>{fmtNum(data.googleRating, 1)}</span>
              {data.googleRating != null ? <YellowStars rating={data.googleRating} /> : null}
            </span>
          }
        />
        <MockMetricCard
          label="New Reviews"
          value={data.gained30d}
          hint={`${data.reviews30d} in last 30 days`}
        />
        <MockMetricCard
          label="Reply Rate"
          value={data.answeredOf > 0 ? `${data.responseRatePct}%` : "—"}
          hint={
            data.answeredOf > 0
              ? `${data.answeredCount} of ${data.answeredOf} answered`
              : undefined
          }
        />
        <MockMetricCard
          label="Competitor Gap"
          value={
            data.competitorReviewGap != null
              ? data.competitorReviewGap > 0
                ? `+${data.competitorReviewGap}`
                : String(data.competitorReviewGap)
              : "—"
          }
          hint={
            data.competitorAvgReviews != null
              ? `vs ${data.competitorAvgReviews} competitor avg`
              : undefined
          }
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <div className="space-y-4 xl:col-span-3">
          <section className={cn(mock.card, "p-5")}>
            <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
              <h2 className="text-[16px] font-semibold text-[#101828]">Recent Reviews</h2>
              <Link href={reviewsHref} className={mock.link}>
                View All Reviews →
              </Link>
            </div>
            {draftStatus ? (
              <p className="mb-3 text-[12px] font-medium text-[#137752]">{draftStatus}</p>
            ) : null}
            {data.recentReviews.length > 0 ? (
              <ul className="divide-y divide-[#F2F4F7]">
                {data.recentReviews.map((review) => (
                  <li
                    key={review.id}
                    className="flex flex-col gap-3 py-3.5 first:pt-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between"
                  >
                    <div className="flex min-w-0 flex-1 gap-3">
                      <span
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#ECFDF3] text-[13px] font-bold text-[#137752]"
                        aria-hidden
                      >
                        {avatarInitial(review.reviewerName)}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-[13px] font-semibold text-[#101828]">
                            {review.reviewerName}
                          </span>
                          {review.rating != null ? <YellowStars rating={review.rating} /> : null}
                          <span className="text-[11px] text-[#98A2B3]">{review.dateLabel}</span>
                        </div>
                        <p className="mt-1 text-[13px] leading-snug text-[#475467]">{review.excerpt}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 sm:shrink-0 sm:pl-2">
                      <button
                        type="button"
                        onClick={() => void generateResponse(review.id, review.reviewerName)}
                        className={cn(mock.btnPrimary, "h-8 px-3 text-[12px]")}
                      >
                        Reply
                      </button>
                      <button
                        type="button"
                        onClick={() => void generateResponse(review.id, review.reviewerName)}
                        className={cn(mock.btnSecondary, "h-8 px-2.5 text-[12px]")}
                        title="Generate response"
                      >
                        <MessageSquare className="h-3.5 w-3.5" />
                        Generate
                      </button>
                      <button
                        type="button"
                        onClick={() => void copyResponse(review.id, review.reviewerName)}
                        className={cn(mock.btnSecondary, "h-8 px-2.5 text-[12px]")}
                        title="Copy response"
                      >
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </button>
                      {review.reviewUrl ? (
                        <a
                          href={review.reviewUrl}
                          target="_blank"
                          rel="noreferrer"
                          className={cn(mock.btnSecondary, "h-8 px-2.5 text-[12px]")}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Google
                        </a>
                      ) : null}
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="py-8 text-center text-sm text-[#667085]">
                Sync reviews to see recent activity here.
              </p>
            )}
          </section>

          <section className={cn(mock.card, "p-5")}>
            <h2 className="mb-3 text-[16px] font-semibold text-[#101828]">Review Trends</h2>
            {data.trendSeries.length > 0 ? (
              <RepAreaTrendChart
                data={data.trendSeries}
                xKey="label"
                height={200}
                series={[
                  { dataKey: "you", name: "You", color: GREEN },
                  { dataKey: "benchmark", name: "Benchmark", color: BLUE, fillOpacity: 0.12 },
                  {
                    dataKey: "competitor",
                    name: "Competitor",
                    color: GREY_LINE,
                    dashed: true,
                    fillOpacity: 0.04,
                  },
                ]}
              />
            ) : (
              <div className="flex flex-col items-center gap-3 py-10 text-center">
                <p className="text-sm text-[#667085]">Run Review Momentum to plot your trend.</p>
                <ReputationSyncButton businessId={businessId} label="Refresh" variant="secondary" />
              </div>
            )}
          </section>
        </div>

        <div className="space-y-4 xl:col-span-2">
          <section className={cn(mock.card, "p-5")}>
            <h2 className="mb-1 text-[16px] font-semibold text-[#101828]">Reputation Tasks</h2>
            <p className="mb-3 text-[12px] text-[#667085]">Checklist for your next replies and requests</p>
            <ul>
              <TaskCheckRow
                title={data.nextAction.title}
                body={data.nextAction.body}
                href={actionHref}
                cta={data.nextAction.ctaLabel}
              />
              {data.unansweredTotal > 0 ? (
                <TaskCheckRow
                  title={`Respond to ${data.unansweredTotal} unanswered review${data.unansweredTotal === 1 ? "" : "s"}`}
                  body={
                    data.unansweredNegative > 0
                      ? `${data.unansweredNegative} negative still waiting`
                      : undefined
                  }
                  href={unansweredHref}
                  cta="Respond now"
                />
              ) : (
                <TaskCheckRow
                  done
                  title="All reviews answered"
                  href={reviewsHref}
                />
              )}
              <TaskCheckRow
                title="Send review requests"
                body="Invite recent customers to leave a Google review."
                href={requestsHref}
                cta="Send requests"
              />
            </ul>
          </section>

          <section className={cn(mock.card, "p-5")}>
            <h2 className="mb-3 text-[16px] font-semibold text-[#101828]">Review Sentiment</h2>
            <SentimentBars {...sentiment} />
            <p className="mt-3 text-[11px] text-[#98A2B3]">
              Based on recent review ratings
              {data.unansweredNegative > 0
                ? ` · ${data.unansweredNegative} unanswered negative`
                : ""}
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
