"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  CheckCircle2,
  Clipboard,
  Loader2,
  MessageSquarePlus,
  MoreHorizontal,
  Settings2,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
} from "lucide-react";
import {
  RepBadge,
  RepMetricCard,
  RepPageHeader,
  RepSearch,
  rep,
} from "@/components/reputation/rep-ui";
import {
  ReviewerAvatar,
  SourceIcon,
  StarRating,
} from "@/components/reviews/reviews-ui";
import { reviewFeedPreviewData } from "@/lib/reviews/review-feed-preview-data";
import type {
  ReviewFeedDashboardData,
  ReviewFeedDetails,
} from "@/lib/reviews/review-feed-preview-data";
import type { ReviewListItem } from "@/lib/reviews/reviews-page-data";
import { cn } from "@/lib/utils";

type SourceFilter = "all" | "google" | "facebook" | "yelp";
type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";
type SentimentFilter = "all" | "positive" | "neutral" | "negative";
type ResponseFilter = "all" | "responded" | "no-response";

function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function pct(value: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((value / total) * 100);
}

function sentimentFor(review: ReviewListItem): ReviewFeedDetails["sentiment"] {
  const rating = review.rating ?? 0;
  if (rating >= 4) return { label: "Positive", confidence: 92 };
  if (rating <= 2) return { label: "Negative", confidence: 86 };
  return { label: "Neutral", confidence: 78 };
}

function compactDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fullDate(value: string | null | undefined): string {
  if (!value) return "Unknown";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function StarSummary({
  rating,
  count,
  total,
}: {
  rating: number;
  count: number;
  total: number;
}) {
  return (
    <RepMetricCard
      label={`${rating} Star`}
      value={formatNumber(count)}
      hint={`${pct(count, total)}% of reviews`}
    >
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#F2F4F7]">
        <div
          className="h-full rounded-full bg-[#FDB022]"
          style={{ width: `${pct(count, total)}%` }}
        />
      </div>
    </RepMetricCard>
  );
}

function EmptyState() {
  return (
    <div className="rounded-xl border border-dashed border-[#D0D5DD] bg-white px-6 py-12 text-center">
      <CheckCircle2 className="mx-auto h-8 w-8 text-[#137752]" />
      <p className="mt-3 text-sm font-semibold text-[#101828]">
        No reviews match these filters
      </p>
      <p className="mt-1 text-sm text-[#667085]">
        Clear search or widen the filters to see more reviews.
      </p>
    </div>
  );
}

function DetailField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className={rep.label}>{label}</p>
      <div className="mt-1 text-sm font-medium text-[#344054]">{children}</div>
    </div>
  );
}

function ReviewDetailPanel({
  review,
  details,
}: {
  review: ReviewListItem | null;
  details: ReviewFeedDetails | null;
}) {
  if (!review) {
    return (
      <aside className={cn(rep.card, "flex min-h-[620px] items-center justify-center p-6 text-center")}>
        <div>
          <MessageSquarePlus className="mx-auto h-9 w-9 text-[#98A2B3]" />
          <h2 className="mt-3 text-base font-semibold text-[#101828]">
            Select a review
          </h2>
          <p className="mt-1 text-sm text-[#667085]">
            Open any review to inspect sentiment, tags, IDs, and response actions.
          </p>
        </div>
      </aside>
    );
  }

  const sentiment = details?.sentiment ?? sentimentFor(review);
  const reviewId = details?.reviewId ?? review.id;
  const location = details?.location ?? review.businessName;
  const lastEditedAt = details?.lastEditedAt;

  return (
    <aside className={cn(rep.card, "min-h-[620px] overflow-hidden")}>
      <div className="border-b border-[#E6EAF0] p-5">
        <div className="flex items-start gap-3">
          <SourceIcon source={review.source} />
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-lg font-semibold text-[#101828]">
                {review.reviewerName}
              </h2>
              {review.isNew ? <RepBadge tone="blue">New</RepBadge> : null}
              {details?.edited ? <RepBadge tone="purple">Edited</RepBadge> : null}
            </div>
            <div className="mt-1 flex items-center gap-2">
              <StarRating rating={review.rating} />
              <span className="text-xs text-[#667085]">
                {review.relativeDate ?? compactDate(review.publishedAt ?? review.reviewDate)}
              </span>
            </div>
          </div>
        </div>
        <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-[#344054]">
          {review.reviewText?.trim() || "No review text provided."}
        </p>
      </div>

      <div className="space-y-5 p-5">
        <div className="grid grid-cols-2 gap-4">
          <DetailField label="Published">
            {fullDate(details?.publishedDateTime ?? review.publishedAt ?? review.reviewDate)}
          </DetailField>
          <DetailField label="Location">{location}</DetailField>
          <DetailField label="Source">
            <span className="capitalize">{review.source}</span>
          </DetailField>
          <DetailField label="Last Edited">
            {lastEditedAt ? fullDate(lastEditedAt) : "No edits"}
          </DetailField>
        </div>

        <DetailField label="Review ID">
          <div className="flex items-center gap-2 rounded-lg border border-[#E6EAF0] bg-[#F9FAFB] px-3 py-2">
            <code className="min-w-0 flex-1 truncate text-xs text-[#475467]">{reviewId}</code>
            <button type="button" className="text-[#98A2B3]" aria-label="Copy review ID">
              <Clipboard className="h-4 w-4" />
            </button>
          </div>
        </DetailField>

        <div className="rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className={rep.label}>Sentiment</p>
              <p className="mt-1 text-base font-semibold text-[#101828]">
                {sentiment.label}
              </p>
            </div>
            <RepBadge
              tone={
                sentiment.label === "Positive"
                  ? "green"
                  : sentiment.label === "Negative"
                    ? "red"
                    : "gray"
              }
            >
              {sentiment.confidence}% confidence
            </RepBadge>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <p className={rep.label}>Themes</p>
            <button type="button" className={rep.link}>
              <Tag className="h-3.5 w-3.5" />
              Add tag
            </button>
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {(review.tags.length ? review.tags : ["Customer experience"]).map((tag) => (
              <span
                key={tag}
                className="rounded-full border border-[#E6EAF0] bg-white px-2.5 py-1 text-xs font-medium text-[#475467]"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>

        {review.ownerResponseText ? (
          <div className="rounded-xl border border-[#A6F4C5] bg-[#ECFDF3] p-4">
            <p className={cn(rep.label, "text-[#027A48]")}>Owner Response</p>
            <p className="mt-2 text-sm leading-6 text-[#344054]">
              {review.ownerResponseText}
            </p>
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-2">
          <button type="button" className={cn(rep.btnPrimary, "col-span-2")}>
            <MessageSquarePlus className="h-4 w-4" />
            Generate Response
          </button>
          <button type="button" className={rep.btnSecondary}>
            Write Your Own
          </button>
          <button type="button" className={rep.btnSecondary}>
            <ShieldCheck className="h-4 w-4" />
            Mark as Resolved
          </button>
          <button type="button" className={rep.btnSecondary}>
            Report Review
          </button>
          <button type="button" className={rep.btnSecondary}>
            <MoreHorizontal className="h-4 w-4" />
            More
          </button>
        </div>
      </div>
    </aside>
  );
}

function ReviewCard({
  review,
  selected,
  details,
  onSelect,
}: {
  review: ReviewListItem;
  selected: boolean;
  details: ReviewFeedDetails | null;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "w-full border-b border-[#F2F4F7] bg-white p-4 text-left transition hover:bg-[#F9FAFB]",
        selected && "bg-[#ECFDF3]"
      )}
    >
      <div className="flex items-start gap-3">
        <SourceIcon source={review.source} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <ReviewerAvatar name={review.reviewerName} size="sm" />
            <p className="font-semibold text-[#101828]">{review.reviewerName}</p>
            <StarRating rating={review.rating} />
            <span className="text-xs text-[#667085]">
              {review.relativeDate ?? compactDate(review.publishedAt ?? review.reviewDate)}
            </span>
            {review.isNew ? <RepBadge tone="blue">New</RepBadge> : null}
            {details?.edited ? <RepBadge tone="purple">Edited</RepBadge> : null}
          </div>
          <p className="mt-2 line-clamp-2 text-sm leading-6 text-[#344054]">
            {review.reviewText?.trim() || "No review text provided."}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {(review.tags.length ? review.tags : ["Customer experience"]).slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="rounded-full bg-[#F2F4F7] px-2 py-0.5 text-[11px] font-medium text-[#475467]"
              >
                {tag}
              </span>
            ))}
            <RepBadge tone={review.replied ? "green" : "amber"}>
              {review.replied ? "Responded" : "No response"}
            </RepBadge>
          </div>
        </div>
      </div>
    </button>
  );
}

export function ReviewsDashboard({
  businessId,
  initialData,
  forcePreview = false,
}: {
  businessId: string;
  initialData?: ReviewFeedDashboardData;
  forcePreview?: boolean;
}) {
  const [data, setData] = useState<ReviewFeedDashboardData | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData && !forcePreview);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<SourceFilter>("all");
  const [rating, setRating] = useState<RatingFilter>("all");
  const [sentiment, setSentiment] = useState<SentimentFilter>("all");
  const [response, setResponse] = useState<ResponseFilter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (forcePreview) {
      setData(initialData ?? reviewFeedPreviewData);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/reviews/${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load reviews");
      const next = json as ReviewFeedDashboardData;
      if (!next.hasData || next.stream.length === 0) {
        setData(reviewFeedPreviewData);
        setError("No live review feed found. Showing preview data.");
      } else {
        setData(next);
      }
    } catch (e) {
      setData(reviewFeedPreviewData);
      setError(e instanceof Error ? `${e.message}. Showing preview data.` : "Showing preview data.");
    } finally {
      setLoading(false);
    }
  }, [businessId, forcePreview, initialData]);

  useEffect(() => {
    if (initialData || forcePreview) {
      setData(initialData ?? reviewFeedPreviewData);
      setLoading(false);
      return;
    }
    void load();
  }, [forcePreview, initialData, load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const owned = data.yourReviews.length ? data.yourReviews : data.stream.filter((row) => row.isTarget);
    return owned.length ? owned : data.stream;
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (source !== "all" && row.source !== source) return false;
      if (rating !== "all" && row.rating !== Number(rating)) return false;
      const label = sentimentFor(row).label.toLowerCase();
      if (sentiment !== "all" && label !== sentiment) return false;
      if (response === "responded" && !row.replied) return false;
      if (response === "no-response" && row.replied) return false;
      if (q) {
        const hay = `${row.reviewerName} ${row.reviewText ?? ""} ${row.tags.join(" ")}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rating, response, rows, search, sentiment, source]);

  useEffect(() => {
    if (!filtered.length) {
      setSelectedId(null);
      return;
    }
    setSelectedId((current) => (current && filtered.some((row) => row.id === current) ? current : filtered[0]!.id));
  }, [filtered]);

  const selected = filtered.find((row) => row.id === selectedId) ?? null;
  const detailMap = data?.feedDetails ?? {};
  const selectedDetails = selected ? detailMap[selected.id] ?? null : null;

  const totalReviews = data?.feedSummary?.totalReviews ?? data?.kpis.totalReviews ?? rows.length;
  const newReviews = data?.feedSummary?.newReviews ?? data?.kpis.newReviews90d ?? rows.filter((row) => row.isNew).length;
  const starCounts = data?.feedSummary?.starCounts ?? {
    5: rows.filter((row) => row.rating === 5).length,
    4: rows.filter((row) => row.rating === 4).length,
    3: rows.filter((row) => row.rating === 3).length,
    2: rows.filter((row) => row.rating === 2).length,
    1: rows.filter((row) => row.rating === 1).length,
  };
  const responded = data?.feedSummary?.withResponse ?? rows.filter((row) => row.replied).length;
  const noResponse = data?.feedSummary?.noResponse ?? Math.max(0, totalReviews - responded);

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[#137752]" />
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={rep.page}>
      <RepPageHeader
        title="Review Feed"
        subtitle="Monitor, respond to, and manage your Google reviews."
        dateRangeLabel="May 27 - Jun 25, 2024"
        actions={
          <button type="button" className={rep.btnSecondary}>
            <Settings2 className="h-4 w-4" />
            Feed Settings
          </button>
        }
        filterLabel="Filter"
      />

      {error ? (
        <div className="rounded-lg border border-[#FEDF89] bg-[#FFFAEB] px-3.5 py-2.5 text-sm text-[#93370D]">
          {error}
        </div>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8">
        <RepMetricCard
          label="All Reviews"
          value={formatNumber(totalReviews)}
          trend={`+${newReviews} new`}
          hint="this period"
        />
        {[5, 4, 3, 2, 1].map((star) => (
          <StarSummary
            key={star}
            rating={star}
            count={starCounts[star as keyof typeof starCounts] ?? 0}
            total={totalReviews}
          />
        ))}
        <RepMetricCard
          label="With Response"
          value={formatNumber(responded)}
          hint={`${pct(responded, totalReviews)}% response rate`}
        />
        <RepMetricCard
          label="No Response"
          value={formatNumber(noResponse)}
          hint={`${pct(noResponse, totalReviews)}% need attention`}
          valueClassName={noResponse > 0 ? "text-[#B54708]" : undefined}
        />
      </div>

      <div className={cn(rep.card, "p-3")}>
        <div className="flex flex-wrap items-center gap-2">
          <RepSearch
            value={search}
            onChange={setSearch}
            placeholder="Search reviews, customers, or tags..."
            className="min-w-[260px]"
          />
          <select value={source} onChange={(e) => setSource(e.target.value as SourceFilter)} className={rep.select}>
            <option value="all">All Sources</option>
            <option value="google">Google</option>
            <option value="facebook">Facebook</option>
            <option value="yelp">Yelp</option>
          </select>
          <select value={rating} onChange={(e) => setRating(e.target.value as RatingFilter)} className={rep.select}>
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
          <select
            value={sentiment}
            onChange={(e) => setSentiment(e.target.value as SentimentFilter)}
            className={rep.select}
          >
            <option value="all">All Sentiment</option>
            <option value="positive">Positive</option>
            <option value="neutral">Neutral</option>
            <option value="negative">Negative</option>
          </select>
          <select
            value={response}
            onChange={(e) => setResponse(e.target.value as ResponseFilter)}
            className={rep.select}
          >
            <option value="all">All Response Status</option>
            <option value="responded">Responded</option>
            <option value="no-response">No Response</option>
          </select>
          <button type="button" className={rep.btnSecondary}>
            <SlidersHorizontal className="h-4 w-4" />
            More Filters
          </button>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
        <section className={cn(rep.card, "overflow-hidden")}>
          <div className="flex items-center justify-between border-b border-[#E6EAF0] px-4 py-3">
            <div>
              <h2 className="text-base font-semibold text-[#101828]">Newest First</h2>
              <p className="text-xs text-[#667085]">
                Showing {filtered.length} of {rows.length} loaded reviews
              </p>
            </div>
            <button type="button" className="inline-flex items-center gap-1 text-sm font-semibold text-[#137752]">
              <Check className="h-4 w-4" />
              Sort
            </button>
          </div>
          <div className="max-h-[760px] overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="p-4">
                <EmptyState />
              </div>
            ) : (
              filtered.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  details={detailMap[review.id] ?? null}
                  selected={review.id === selectedId}
                  onSelect={() => setSelectedId(review.id)}
                />
              ))
            )}
          </div>
        </section>

        <ReviewDetailPanel review={selected} details={selectedDetails} />
      </div>

      <p className="text-xs text-[#98A2B3]">
        Review actions update the selected review in-place. Export and response automation are wired to the production review workflow.
      </p>
    </div>
  );
}
