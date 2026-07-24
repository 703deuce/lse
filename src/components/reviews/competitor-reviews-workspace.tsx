"use client";

import { useMemo, useState } from "react";
import { Check, CheckCircle2, GitCompare, Star } from "lucide-react";
import { ReviewDetailDrawer } from "@/components/reviews/review-detail-drawer";
import { StarRating } from "@/components/reviews/reviews-ui";
import { RepBadge, rep } from "@/components/reputation/rep-ui";
import type { CompetitorLeaderboardRow } from "@/lib/reviews/competitor-intelligence-data";
import type { ReviewListItem } from "@/lib/reviews/reviews-page-data";
import { cn } from "@/lib/utils";

const COMPANY_COLORS = ["#2563EB", "#7C3AED", "#0891B2", "#DB2777", "#CA8A04", "#4F46E5"];

type CompanyOption = {
  id: string;
  name: string;
  shortName: string;
  isYou: boolean;
  count: number;
  color: string;
  row: CompetitorLeaderboardRow | null;
};

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length <= 2) return name;
  return parts.slice(0, 2).join(" ");
}

function companyKey(review: ReviewListItem, youId: string): string {
  if (review.isTarget) return youId;
  return review.competitorId ?? review.businessName;
}

function topThemes(reviews: ReviewListItem[], positive: boolean, limit = 3): string[] {
  const counts = new Map<string, number>();
  for (const review of reviews) {
    const rating = review.rating ?? 0;
    if (positive && rating > 0 && rating < 4) continue;
    if (!positive && rating >= 4) continue;
    for (const tag of review.tags) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }
  }
  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

function fmt(value: number | null | undefined, digits = 0): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(value);
}

export function CompetitorReviewsWorkspace({
  businessId,
  businessName,
  leaderboardRows,
  reviewsFeed,
}: {
  businessId: string;
  businessName: string;
  leaderboardRows: CompetitorLeaderboardRow[];
  reviewsFeed: ReviewListItem[];
}) {
  const youId = leaderboardRows.find((row) => row.isYou)?.id ?? businessId;
  const companies = useMemo<CompanyOption[]>(() => {
    const counts = new Map<string, number>();
    for (const review of reviewsFeed) {
      const key = companyKey(review, youId);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const fromBoard = leaderboardRows.map((row, index) => ({
      id: row.id,
      name: row.isYou ? businessName || row.name : row.name,
      shortName: row.isYou ? "You" : shortName(row.name),
      isYou: row.isYou,
      count: counts.get(row.id) ?? (row.isYou ? counts.get(youId) ?? 0 : 0),
      color: row.isYou ? "#137752" : COMPANY_COLORS[index % COMPANY_COLORS.length]!,
      row,
    }));
    return fromBoard.sort((a, b) => Number(b.isYou) - Number(a.isYou) || b.count - a.count);
  }, [businessName, leaderboardRows, reviewsFeed, youId]);

  const [selectedIds, setSelectedIds] = useState<string[]>(["all"]);
  const [compareMode, setCompareMode] = useState(false);
  const [ratingFilter, setRatingFilter] = useState<"all" | "5" | "4" | "3" | "low">("all");
  const [selectedReview, setSelectedReview] = useState<ReviewListItem | null>(null);

  const activeIds = useMemo(() => {
    if (selectedIds.includes("all") && !compareMode) return null;
    return new Set(selectedIds.filter((id) => id !== "all"));
  }, [compareMode, selectedIds]);

  const filteredReviews = useMemo(() => {
    return reviewsFeed.filter((review) => {
      const key = companyKey(review, youId);
      if (activeIds && activeIds.size > 0 && !activeIds.has(key)) return false;
      if (ratingFilter === "5" && review.rating !== 5) return false;
      if (ratingFilter === "4" && review.rating !== 4) return false;
      if (ratingFilter === "3" && review.rating !== 3) return false;
      if (ratingFilter === "low" && (review.rating == null || review.rating > 2)) return false;
      return true;
    });
  }, [activeIds, ratingFilter, reviewsFeed, youId]);

  const snapshotCompany = useMemo(() => {
    if (!activeIds || activeIds.size !== 1) return null;
    const id = Array.from(activeIds)[0]!;
    return companies.find((company) => company.id === id) ?? null;
  }, [activeIds, companies]);

  const snapshotReviews = useMemo(() => {
    if (!snapshotCompany) return [];
    return reviewsFeed.filter((review) => companyKey(review, youId) === snapshotCompany.id);
  }, [reviewsFeed, snapshotCompany, youId]);

  const praised = topThemes(snapshotReviews, true);
  const complaints = topThemes(snapshotReviews, false);

  function selectSingle(id: string) {
    setCompareMode(false);
    setSelectedIds([id]);
  }

  function toggleCompare(id: string) {
    setCompareMode(true);
    setSelectedIds((prev) => {
      const withoutAll = prev.filter((value) => value !== "all");
      if (withoutAll.includes(id)) {
        const next = withoutAll.filter((value) => value !== id);
        return next.length ? next : ["all"];
      }
      return [...withoutAll, id];
    });
  }

  const companyColor = (id: string) => companies.find((company) => company.id === id)?.color ?? "#667085";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
              Business
            </span>
            <select
              value={compareMode ? "compare" : selectedIds[0] ?? "all"}
              onChange={(event) => {
                const value = event.target.value;
                if (value === "compare") {
                  setCompareMode(true);
                  setSelectedIds(companies.slice(0, 2).map((company) => company.id));
                  return;
                }
                selectSingle(value);
              }}
              className="min-w-[220px] rounded-lg border border-[#E6EAF0] bg-white px-3 py-2 text-sm font-semibold text-[#101828] outline-none focus:border-[#137752]"
            >
              <option value="all">All Competitors</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.isYou ? `You — ${company.name}` : company.name}
                </option>
              ))}
              <option value="compare">Compare mode…</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
              Rating
            </span>
            <select
              value={ratingFilter}
              onChange={(event) => setRatingFilter(event.target.value as typeof ratingFilter)}
              className="rounded-lg border border-[#E6EAF0] bg-white px-3 py-2 text-sm font-semibold text-[#101828] outline-none focus:border-[#137752]"
            >
              <option value="all">All ratings</option>
              <option value="5">5 star</option>
              <option value="4">4 star</option>
              <option value="3">3 star</option>
              <option value="low">1–2 star</option>
            </select>
          </label>
        </div>
        <button
          type="button"
          onClick={() => {
            if (compareMode) {
              setCompareMode(false);
              setSelectedIds(["all"]);
              return;
            }
            setCompareMode(true);
            setSelectedIds(companies.slice(0, 2).map((company) => company.id));
          }}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition",
            compareMode
              ? "border-[#137752] bg-[#ECFDF3] text-[#027A48]"
              : "border-[#E6EAF0] bg-white text-[#344054] hover:border-[#B7E4D0]"
          )}
        >
          <GitCompare className="h-4 w-4" />
          {compareMode ? "Compare on" : "Compare mode"}
        </button>
      </div>

      <div>
        <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">Companies</p>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => selectSingle("all")}
            className={cn(
              "rounded-full px-3 py-1.5 text-xs font-semibold transition",
              !compareMode && selectedIds.includes("all")
                ? "bg-[#101828] text-white"
                : "bg-[#F2F4F7] text-[#344054] hover:bg-[#E4E7EC]"
            )}
          >
            All ({reviewsFeed.length})
          </button>
          {companies.map((company) => {
            const active = selectedIds.includes(company.id);
            return (
              <button
                key={company.id}
                type="button"
                onClick={() => (compareMode ? toggleCompare(company.id) : selectSingle(company.id))}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition",
                  active
                    ? "text-white"
                    : "bg-[#F2F4F7] text-[#344054] hover:bg-[#E4E7EC]"
                )}
                style={active ? { backgroundColor: company.color } : undefined}
              >
                {compareMode ? (
                  <span
                    className={cn(
                      "inline-flex h-3.5 w-3.5 items-center justify-center rounded border",
                      active ? "border-white/80 bg-white/20" : "border-[#98A2B3] bg-white"
                    )}
                  >
                    {active ? <Check className="h-2.5 w-2.5" /> : null}
                  </span>
                ) : null}
                {company.shortName} ({company.count})
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className={cn(rep.card, "p-4")}>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-semibold text-[#101828]">Competitor Reviews</h2>
              <p className="mt-0.5 text-xs text-[#667085]">
                {filteredReviews.length} review{filteredReviews.length === 1 ? "" : "s"}
                {compareMode ? " · compare mode" : ""}
              </p>
            </div>
          </div>
          <div className="space-y-3">
            {filteredReviews.length === 0 ? (
              <p className="py-12 text-center text-sm text-[#667085]">
                No reviews match this filter. Refresh reputation data or pick another company.
              </p>
            ) : (
              filteredReviews.slice(0, 80).map((review) => {
                const key = companyKey(review, youId);
                const color = companyColor(key);
                return (
                  <button
                    key={review.id}
                    type="button"
                    onClick={() => setSelectedReview(review)}
                    className="w-full rounded-xl border border-[#E6EAF0] bg-[#F9FAFB] p-4 text-left transition hover:border-[#B7E4D0] hover:bg-[#F6FEF9]"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <StarRating rating={review.rating} />
                      {(compareMode || !selectedIds.includes("all")) && (
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-white"
                          style={{ backgroundColor: color }}
                        >
                          {review.isTarget ? "You" : shortName(review.businessName)}
                        </span>
                      )}
                    </div>
                    <p className="mt-2 font-semibold text-[#101828]">{review.businessName}</p>
                    <p className="text-xs text-[#98A2B3]">{review.relativeDate ?? "Unknown date"}</p>
                    <p className="mt-2 line-clamp-3 text-sm leading-5 text-[#344054]">
                      {review.reviewText?.trim() || "No review text provided."}
                    </p>
                    {review.tags.length ? (
                      <div className="mt-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                          Themes
                        </p>
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {review.tags.slice(0, 4).map((tag) => (
                            <span
                              key={tag}
                              className="rounded-md bg-white px-2 py-0.5 text-[11px] font-medium text-[#344054] ring-1 ring-[#E6EAF0]"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </div>
                    ) : null}
                    {review.replied ? (
                      <p className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[#027A48]">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Owner responded
                      </p>
                    ) : (
                      <p className="mt-3 text-xs font-medium text-[#98A2B3]">No owner response</p>
                    )}
                  </button>
                );
              })
            )}
          </div>
        </section>

        <aside className="space-y-4">
          {snapshotCompany ? (
            <section className={cn(rep.card, "p-4")}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                Company Snapshot
              </p>
              <h3 className="mt-1 text-lg font-bold text-[#101828]">{snapshotCompany.name}</h3>
              <div className="mt-2 flex items-center gap-2">
                <Star className="h-4 w-4 fill-[#FDB022] text-[#FDB022]" />
                <span className="text-xl font-bold tabular-nums text-[#101828]">
                  {fmt(snapshotCompany.row?.rating, 1)}
                </span>
              </div>
              <p className="mt-1 text-sm text-[#667085]">
                {fmt(snapshotCompany.row?.totalReviews)} reviews · {fmt(snapshotCompany.row?.reviews90)} in
                last 90 days
              </p>
              {snapshotCompany.row?.momentumLabel ? (
                <div className="mt-3">
                  <RepBadge tone="green">{snapshotCompany.row.momentumLabel}</RepBadge>
                </div>
              ) : null}

              <div className="mt-5">
                <p className="text-xs font-semibold text-[#101828]">Most Mentioned</p>
                <ul className="mt-2 space-y-1.5">
                  {(praised.length ? praised : ["No themes yet"]).map((theme) => (
                    <li key={theme} className="flex items-center gap-2 text-sm text-[#344054]">
                      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#137752]" />
                      {theme}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-4">
                <p className="text-xs font-semibold text-[#101828]">Common Complaints</p>
                <ul className="mt-2 space-y-1.5">
                  {(complaints.length ? complaints : ["No complaint themes yet"]).map((theme) => (
                    <li key={theme} className="text-sm text-[#344054]">
                      • {theme}
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-3 border-t border-[#F2F4F7] pt-4">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                    Response Rate
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-[#101828]">
                    {fmt(snapshotCompany.row?.responseRate)}%
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                    Avg Response
                  </p>
                  <p className="mt-1 text-lg font-bold tabular-nums text-[#101828]">
                    {snapshotCompany.row?.responseSpeedDaysAvg != null
                      ? `${fmt(snapshotCompany.row.responseSpeedDaysAvg, 1)} days`
                      : "—"}
                  </p>
                </div>
              </div>
            </section>
          ) : (
            <section className={cn(rep.card, "p-4")}>
              <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-[#98A2B3]">
                Company Snapshot
              </p>
              <h3 className="mt-1 text-base font-semibold text-[#101828]">Pick one company</h3>
              <p className="mt-2 text-sm leading-5 text-[#667085]">
                Select a single business chip to see rating, pace, themes, complaints, and response
                metrics instantly.
              </p>
              {compareMode ? (
                <p className="mt-3 text-xs font-medium text-[#027A48]">
                  Compare mode is on — check 2+ companies to scan their reviews side by side.
                </p>
              ) : null}
            </section>
          )}

          <section className={cn(rep.card, "p-4")}>
            <p className="text-sm font-semibold text-[#101828]">Research tip</p>
            <p className="mt-2 text-sm leading-5 text-[#667085]">
              Click any review to open details in a drawer — no page change. Use Compare mode to
              check praise, complaints, and response style across two brands at once.
            </p>
          </section>
        </aside>
      </div>

      <ReviewDetailDrawer
        review={selectedReview}
        businessId={selectedReview?.isTarget ? businessId : undefined}
        onClose={() => setSelectedReview(null)}
      />
    </div>
  );
}
