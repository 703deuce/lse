"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { MessageSquare, Sparkles, X } from "lucide-react";
import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import { ReviewDetailDrawer } from "@/components/reviews/review-detail-drawer";
import { ReviewerAvatar, ReviewsTable, RvCard, StarRating } from "@/components/reviews/reviews-ui";
import { dashboardCardTitle, dashboardMicro } from "@/components/overview/dashboard-ui";
import { cn } from "@/lib/utils";

function draftReply(review: ReviewListItem): string {
  const first = review.reviewerName.split(" ")[0] || "there";
  const rating = review.rating ?? 5;
  if (rating <= 2) {
    return `Hi ${first}, thank you for sharing this feedback. We're sorry your experience wasn't up to our standard — we'd like to make it right. Please reply here or reach out directly so we can help.`;
  }
  if (rating === 3) {
    return `Hi ${first}, thank you for taking the time to leave a review. We're glad you came in and would love to know how we can improve next time.`;
  }
  return `Thank you for your wonderful review, ${first}! We're thrilled we could help and appreciate you taking the time to share your experience.`;
}

export function ReviewsUnansweredTab({ data, businessId }: { data: ReviewsPageData; businessId: string }) {
  const [tipDismissed, setTipDismissed] = useState(false);
  const [selectedId, setSelectedId] = useState(data.unanswered[0]?.id ?? "");
  const [selectedReview, setSelectedReview] = useState<ReviewListItem | null>(null);
  const [copied, setCopied] = useState(false);
  const [replyBusy, setReplyBusy] = useState(false);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const selected = data.unanswered.find((r) => r.id === selectedId) ?? data.unanswered[0];
  const suggested = useMemo(() => {
    if (!selected) return "";
    return aiDraft ?? draftReply(selected);
  }, [selected, aiDraft]);

  async function copyReply() {
    if (!suggested) return;
    await navigator.clipboard.writeText(suggested);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  async function regenerate() {
    if (!selected) return;
    setReplyBusy(true);
    setReplyError(null);
    try {
      const res = await fetch("/api/reputation/responses/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ businessId, reviewIds: [selected.id] }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Could not generate a reply");
      const text =
        (json.drafts?.[0]?.draftText as string | undefined) ??
        (json.drafts?.[0]?.draft_text as string | undefined) ??
        (json.drafts?.[0]?.body as string | undefined) ??
        null;
      if (text?.trim()) setAiDraft(text.trim());
      else setAiDraft(draftReply(selected));
    } catch (err) {
      setReplyError(err instanceof Error ? err.message : "Could not generate a reply");
      setAiDraft(draftReply(selected));
    } finally {
      setReplyBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-3 xl:col-span-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <h3 className={dashboardCardTitle}>Unanswered Reviews ({data.unanswered.length})</h3>
              <p className={dashboardMicro}>
                Prioritized by urgency and time waiting (oldest first). Click a row to read the full review.
              </p>
            </div>
          </div>
          <RvCard className="!p-0 overflow-hidden">
            <ReviewsTable
              rows={data.unanswered.slice(0, 8)}
              mode="urgency"
              onViewReview={(row) => {
                setSelectedId(row.id);
                setSelectedReview(row);
                setAiDraft(null);
                setReplyError(null);
              }}
            />
          </RvCard>
          <p className={dashboardMicro}>
            Showing 1–{Math.min(8, data.unanswered.length)} of {data.unanswered.length} reviews
          </p>
        </div>

        <div className="space-y-3">
          <RvCard>
            <div className="mb-2.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
                <h3 className={dashboardCardTitle}>Suggested reply</h3>
              </div>
              <Link
                href={`/businesses/${businessId}/review-requests`}
                className="rounded-md bg-[#137752] px-2 py-1 text-[11px] font-medium text-white hover:bg-[#0f6344]"
              >
                Request reviews
              </Link>
            </div>
            {selected ? (
              <>
                <div className="flex items-center gap-2 border-b border-zinc-100 pb-2.5">
                  <ReviewerAvatar name={selected.reviewerName} size="sm" />
                  <div>
                    <p className="text-[13px] font-medium text-zinc-900">{selected.reviewerName}</p>
                    <StarRating rating={selected.rating} />
                  </div>
                </div>
                <p className="mt-2 text-[13px] text-zinc-600 line-clamp-3">{selected.reviewText}</p>
                <button
                  type="button"
                  onClick={() => setSelectedReview(selected)}
                  className="mt-1.5 text-[12px] font-medium text-emerald-600 hover:text-emerald-700"
                >
                  Read full review →
                </button>
                <div className="mt-2 rounded-lg border border-emerald-100 bg-emerald-50/50 p-2.5 text-[13px] text-zinc-700">
                  <p className="text-[11px] font-medium text-emerald-700">
                    {aiDraft ? "Generated reply" : "Starter draft"}
                  </p>
                  <p className="mt-2 whitespace-pre-wrap">{suggested}</p>
                </div>
                {replyError && <p className="mt-2 text-[12px] text-amber-700">{replyError}</p>}
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => void copyReply()}
                    className="rounded-md bg-[#137752] px-2.5 py-1 text-[11px] font-medium text-white"
                  >
                    {copied ? "Copied" : "Copy reply"}
                  </button>
                  <button
                    type="button"
                    disabled={replyBusy}
                    onClick={() => void regenerate()}
                    className="rounded-lg border border-zinc-200 px-2.5 py-1 text-[11px] font-medium disabled:opacity-60"
                  >
                    {replyBusy ? "Generating…" : "Generate with AI"}
                  </button>
                </div>
                <p className={cn(dashboardMicro, "mt-2")}>
                  Google reply posting isn’t connected yet — copy this into Google Business Profile.
                </p>
              </>
            ) : (
              <p className={dashboardMicro}>No unanswered reviews — great job!</p>
            )}
          </RvCard>

          <RvCard>
            <h3 className={dashboardCardTitle}>Unanswered Impact (Last 90 Days)</h3>
            <dl className="mt-2 space-y-2 text-[13px]">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Waiting for reply</dt>
                <dd className="font-semibold">{data.unanswered.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Urgent</dt>
                <dd className="font-semibold">{data.kpis.urgentCount} reviews</dd>
              </div>
            </dl>
            <Link
              href={`/businesses/${businessId}/review-momentum`}
              className="mt-3 inline-block text-[12px] font-medium text-emerald-600"
            >
              Open Review Momentum →
            </Link>
          </RvCard>

          {!tipDismissed && (
            <RvCard className="relative border-amber-100 bg-amber-50/40">
              <button
                type="button"
                onClick={() => setTipDismissed(true)}
                className="absolute right-2 top-2 rounded p-1 text-zinc-400 hover:bg-white/70"
                aria-label="Dismiss tip"
              >
                <X className="h-3.5 w-3.5" />
              </button>
              <div className="flex items-start gap-2 pr-6">
                <MessageSquare className="mt-0.5 h-3.5 w-3.5 text-amber-700" />
                <div>
                  <p className="text-[13px] font-medium text-zinc-900">Reply faster tip</p>
                  <p className={dashboardMicro}>
                    Prioritize low ratings and oldest unanswered reviews — both protect your public rating
                    signal.
                  </p>
                </div>
              </div>
            </RvCard>
          )}
        </div>
      </div>

      {selectedReview && (
        <ReviewDetailDrawer review={selectedReview} onClose={() => setSelectedReview(null)} />
      )}
    </div>
  );
}
