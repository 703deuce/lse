"use client";

import { X } from "lucide-react";
import type { ReviewListItem } from "@/lib/reviews/reviews-page-data";
import {
  BusinessCell,
  ReviewStatusBadge,
  ReviewerAvatar,
  SourceIcon,
  StarRating,
  TagPills,
} from "@/components/reviews/reviews-ui";
import { HighlightedReviewText } from "@/components/reviews/highlighted-review-text";

function readableOwnerResponse(text: string | null): string | null {
  if (!text?.trim()) return null;
  const trimmed = text.trim();
  if (trimmed.startsWith("{")) {
    try {
      const parsed = JSON.parse(trimmed) as { response_from_owner_string?: string };
      const reply = parsed.response_from_owner_string?.trim();
      return reply || null;
    } catch {
      return null;
    }
  }
  return trimmed;
}

export function ReviewDetailDrawer({
  review,
  highlightPhrases = [],
  onClose,
}: {
  review: ReviewListItem | null;
  highlightPhrases?: string[];
  onClose: () => void;
}) {
  if (!review) return null;

  const dateLabel = review.reviewDate
    ? new Date(review.reviewDate).toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
        year: "numeric",
      })
    : null;

  const ownerReply = readableOwnerResponse(review.ownerResponseText);

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/40" onClick={onClose} role="presentation">
      <div
        className="flex h-full w-full max-w-xl flex-col bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Review details"
      >
        <div className="flex items-start justify-between gap-4 border-b border-zinc-200 px-6 py-4">
          <div className="flex min-w-0 items-start gap-3">
            <ReviewerAvatar name={review.reviewerName} />
            <div className="min-w-0">
              <p className="font-semibold text-zinc-900">{review.reviewerName}</p>
              {!review.isTarget && (
                <p className="text-sm text-zinc-500">{review.businessName}</p>
              )}
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <StarRating rating={review.rating} size="md" />
                <ReviewStatusBadge replied={review.replied} variant="pill" />
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 hover:bg-zinc-100" aria-label="Close">
            <X className="h-5 w-5 text-zinc-500" />
          </button>
        </div>

        <div className="flex-1 space-y-5 overflow-y-auto px-6 py-5">
          <div className="flex flex-wrap items-center gap-4 text-sm text-zinc-600">
            {!review.isTarget && <BusinessCell row={review} />}
            <div className="flex items-center gap-2">
              <SourceIcon source={review.source} />
              <span className="capitalize">{review.source}</span>
            </div>
            {dateLabel && (
              <div>
                <p className="font-medium text-zinc-900">{dateLabel}</p>
                {review.relativeDate && <p className="text-xs text-zinc-500">{review.relativeDate}</p>}
              </div>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Full review</p>
            {highlightPhrases.length > 0 ? (
              <div className="mt-3">
                <HighlightedReviewText
                  text={review.reviewText}
                  phrases={highlightPhrases}
                  className="text-base text-zinc-800"
                />
                <p className="mt-2 text-xs text-zinc-500">
                  Highlighted words are what triggered this theme match.
                </p>
              </div>
            ) : (
              <p className="mt-3 whitespace-pre-wrap text-base leading-relaxed text-zinc-800">
                {review.reviewText?.trim() || "No review text provided."}
              </p>
            )}
          </div>

          {review.tags.length > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Keywords</p>
              <div className="mt-2">
                <TagPills tags={review.tags} />
              </div>
            </div>
          )}

          {ownerReply && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700">Your reply</p>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-zinc-700">{ownerReply}</p>
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-zinc-200 px-6 py-4">
          {!review.replied && (
            <button type="button" className="rounded-md bg-[#137752] px-4 py-2 text-sm font-medium text-white hover:bg-[#0f6344]">
              Reply
            </button>
          )}
          <button type="button" onClick={onClose} className="rounded-lg border border-zinc-200 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
