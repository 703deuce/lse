"use client";

import type { ReviewListItem } from "@/lib/reviews/reviews-page-data";
import {
  BusinessCell,
  ReviewStatusBadge,
  ReviewerAvatar,
  SourceIcon,
  StarRating,
  TagPills,
} from "@/components/reviews/reviews-ui";

export function ReviewFeedList({
  rows,
  onViewReview,
  showBusiness = false,
  previewLines = 0,
}: {
  rows: ReviewListItem[];
  onViewReview: (review: ReviewListItem) => void;
  showBusiness?: boolean;
  /** 0 = show full text; 3+ = clamp preview */
  previewLines?: number;
}) {
  if (!rows.length) {
    return <p className="py-6 text-center text-[13px] text-zinc-500">No reviews match your filters.</p>;
  }

  return (
    <div className="divide-y divide-zinc-100">
      {rows.map((row) => {
        const text = row.reviewText?.trim() || "No review text.";
        const isLong = text.length > 280;
        const showPreview = previewLines > 0 && isLong;

        return (
          <article key={row.id} className="py-2.5 first:pt-0 last:pb-0">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="flex min-w-0 items-start gap-2.5">
                {!showBusiness && <ReviewerAvatar name={row.reviewerName} size="sm" />}
                <div className="min-w-0">
                  {showBusiness ? (
                    <BusinessCell row={row} />
                  ) : (
                    <p className="text-[13px] font-semibold text-zinc-900">{row.reviewerName}</p>
                  )}
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    <StarRating rating={row.rating} />
                    {row.reviewDate && (
                      <span className="text-[11px] text-zinc-500">
                        {new Date(row.reviewDate).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                        {row.relativeDate ? ` · ${row.relativeDate}` : ""}
                      </span>
                    )}
                    <SourceIcon source={row.source} />
                  </div>
                </div>
              </div>
              <ReviewStatusBadge replied={row.replied} variant="pill" />
            </div>

            <p
              className={
                showPreview
                  ? "mt-2 line-clamp-3 text-[13px] leading-snug text-zinc-700"
                  : "mt-2 whitespace-pre-wrap text-[13px] leading-snug text-zinc-700"
              }
            >
              {text}
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              {row.tags.length > 0 && <TagPills tags={row.tags} />}
              <button
                type="button"
                onClick={() => onViewReview(row)}
                className="text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
              >
                {showPreview ? "Read full review →" : "Open review →"}
              </button>
            </div>
          </article>
        );
      })}
    </div>
  );
}
