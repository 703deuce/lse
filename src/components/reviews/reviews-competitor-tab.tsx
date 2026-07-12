"use client";

import { useEffect, useMemo, useState } from "react";
import { Building2, CheckCircle2, Clock, DollarSign, SlidersHorizontal, Smile } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import { ReviewDetailDrawer } from "@/components/reviews/review-detail-drawer";
import { ReviewFeedList } from "@/components/reviews/review-feed-list";
import { MiniSpark, ReviewsPagination, RvCard, StarRating } from "@/components/reviews/reviews-ui";

const LINE_COLORS = ["#059669", "#2563eb", "#7c3aed", "#ea580c", "#dc2626"];
const REVIEWS_PER_PAGE = 10;

type CompetitorGroup = {
  id: string;
  name: string;
  rating: number | null;
  newReviews90d: number;
  reviews: ReviewListItem[];
};

function CompetitorReviewSection({
  group,
  onViewReview,
}: {
  group: CompetitorGroup;
  onViewReview: (review: ReviewListItem) => void;
}) {
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [group.id, group.reviews.length]);

  const pageRows = useMemo(() => {
    const start = (page - 1) * REVIEWS_PER_PAGE;
    return group.reviews.slice(start, start + REVIEWS_PER_PAGE);
  }, [group.reviews, page]);

  return (
    <RvCard>
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 border-b border-zinc-100 pb-4">
        <div className="flex min-w-0 items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-zinc-100">
            <Building2 className="h-5 w-5 text-zinc-600" />
          </span>
          <div className="min-w-0">
            <h3 className="text-base font-semibold text-zinc-900">{group.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-sm text-zinc-600">
              <StarRating rating={group.rating} />
              <span>{group.reviews.length} review{group.reviews.length === 1 ? "" : "s"} (90 days)</span>
              {group.newReviews90d > 0 && (
                <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                  {group.newReviews90d} new this period
                </span>
              )}
            </div>
          </div>
        </div>
      </div>

      <p className="mb-4 text-sm text-zinc-600">
        All reviews for {group.name} — full text shown below. Click any review to open the reader panel.
      </p>

      <ReviewFeedList rows={pageRows} onViewReview={onViewReview} previewLines={0} />
      <ReviewsPagination
        page={page}
        pageSize={REVIEWS_PER_PAGE}
        total={group.reviews.length}
        onPageChange={setPage}
      />
    </RvCard>
  );
}

export function ReviewsCompetitorTab({ data }: { data: ReviewsPageData }) {
  const [competitorFilter, setCompetitorFilter] = useState<string>("all");
  const [selectedReview, setSelectedReview] = useState<ReviewListItem | null>(null);

  const chartData = useMemo(() => {
    const weeks = 12;
    const points: Array<Record<string, number | string>> = [];
    for (let w = weeks; w >= 0; w--) {
      const label = `W${weeks - w + 1}`;
      const row: Record<string, number | string> = { week: label };
      for (const c of data.competitors) {
        const idx = weeks - w;
        row[c.name] = c.velocitySpark[idx] ?? 0;
      }
      points.push(row);
    }
    return points;
  }, [data.competitors]);

  const competitorGroups = useMemo((): CompetitorGroup[] => {
    return data.competitors
      .map((c) => ({
        id: c.id,
        name: c.name,
        rating: c.avgRating ?? c.rating,
        newReviews90d: c.newReviews90d,
        reviews: data.competitorReviews
          .filter((r) => r.competitorId === c.id)
          .sort((a, b) => {
            const da = a.reviewDate ? new Date(a.reviewDate).getTime() : 0;
            const db = b.reviewDate ? new Date(b.reviewDate).getTime() : 0;
            return db - da;
          }),
      }))
      .filter((g) => g.reviews.length > 0);
  }, [data.competitors, data.competitorReviews]);

  const visibleGroups = useMemo(() => {
    if (competitorFilter === "all") return competitorGroups;
    return competitorGroups.filter((g) => g.id === competitorFilter);
  }, [competitorFilter, competitorGroups]);

  const totalCompetitorReviews = data.competitorReviews.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={competitorFilter}
          onChange={(e) => setCompetitorFilter(e.target.value)}
          className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700"
        >
          <option value="all">All Competitors ({data.competitors.length})</option>
          {data.competitors.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({data.competitorReviews.filter((r) => r.competitorId === c.id).length} reviews)
            </option>
          ))}
        </select>
        <select className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
          <option>Last 90 days</option>
        </select>
        <select className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-700">
          <option>All Ratings</option>
        </select>
        <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm font-medium text-zinc-700">
          <SlidersHorizontal className="h-4 w-4" />
          More Filters
        </button>
      </div>

      <div className="grid gap-4 xl:grid-cols-5">
        <RvCard className="xl:col-span-3">
          <h3 className="text-sm font-semibold text-zinc-900">Competitor Leaderboard (Last 90 Days)</h3>
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-100 text-xs font-medium uppercase text-zinc-500">
                  <th className="pb-2 pr-3">#</th>
                  <th className="pb-2 pr-3">Competitor</th>
                  <th className="pb-2 pr-3">Avg. Rating</th>
                  <th className="pb-2 pr-3">Total Reviews</th>
                  <th className="pb-2 pr-3">New Reviews</th>
                  <th className="pb-2">Review Velocity</th>
                </tr>
              </thead>
              <tbody>
                {data.competitors.map((c, i) => (
                  <tr key={c.id} className="border-b border-zinc-50">
                    <td className="py-3 pr-3 text-zinc-500">{i + 1}</td>
                    <td className="py-3 pr-3 font-medium text-zinc-900">{c.name}</td>
                    <td className="py-3 pr-3">{c.avgRating?.toFixed(1) ?? c.rating?.toFixed(1) ?? "—"}</td>
                    <td className="py-3 pr-3">{c.totalReviews}</td>
                    <td className="py-3 pr-3">
                      <span>{c.newReviews90d}</span>
                      {c.newReviewsDeltaPct != null && (
                        <span
                          className={`ml-2 rounded px-1.5 py-0.5 text-xs font-medium ${
                            c.newReviewsDeltaPct >= 0 ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700"
                          }`}
                        >
                          {c.newReviewsDeltaPct >= 0 ? "↑" : "↓"} {Math.abs(c.newReviewsDeltaPct)}%
                        </span>
                      )}
                    </td>
                    <td className="py-3">
                      <MiniSpark data={c.velocitySpark} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </RvCard>

        <RvCard className="xl:col-span-2">
          <h3 className="text-sm font-semibold text-zinc-900">Competitor Momentum</h3>
          <div className="mt-4 h-48">
            {data.competitors.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f4f4f5" />
                  <XAxis dataKey="week" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} width={28} />
                  <Tooltip />
                  {data.competitors.slice(0, 5).map((c, i) => (
                    <Line key={c.id} type="monotone" dataKey={c.name} stroke={LINE_COLORS[i % LINE_COLORS.length]} dot={false} strokeWidth={2} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-zinc-500">No competitor momentum data.</p>
            )}
          </div>
          <div className="mt-2 flex flex-wrap gap-3">
            {data.competitors.slice(0, 5).map((c, i) => (
              <span key={c.id} className="flex items-center gap-1 text-xs text-zinc-600">
                <span className="h-2 w-2 rounded-full" style={{ background: LINE_COLORS[i % LINE_COLORS.length] }} />
                {c.name}
              </span>
            ))}
          </div>
        </RvCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-zinc-900">
              Competitor Reviews by Company ({totalCompetitorReviews} total)
            </h3>
            {competitorFilter !== "all" && (
              <button
                type="button"
                onClick={() => setCompetitorFilter("all")}
                className="text-sm font-medium text-emerald-600 hover:text-emerald-700"
              >
                Show all competitors →
              </button>
            )}
          </div>

          {visibleGroups.length === 0 ? (
            <RvCard>
              <p className="text-sm text-zinc-500">No competitor reviews synced for this filter yet.</p>
            </RvCard>
          ) : (
            visibleGroups.map((group) => (
              <CompetitorReviewSection key={group.id} group={group} onViewReview={setSelectedReview} />
            ))
          )}
        </div>

        <div className="space-y-4">
          <RvCard>
            <h3 className="text-sm font-semibold text-zinc-900">Top Strengths</h3>
            <ul className="mt-3 space-y-3 text-sm">
              <li className="flex gap-2"><Clock className="h-4 w-4 text-emerald-600" /> On-time arrival mentioned often</li>
              <li className="flex gap-2"><DollarSign className="h-4 w-4 text-emerald-600" /> Fair pricing themes</li>
              <li className="flex gap-2"><Smile className="h-4 w-4 text-emerald-600" /> Professional, friendly crews</li>
            </ul>
          </RvCard>
          <RvCard>
            <h3 className="text-sm font-semibold text-zinc-900">Common Praise Themes</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {data.sentiment.competitors.flatMap((c) => c.themes).length === 0 ? (
                <p className="text-sm text-zinc-500">No competitor theme data yet.</p>
              ) : (
                Object.entries(
                  data.sentiment.competitors
                    .flatMap((c) => c.themes)
                    .reduce<Record<string, number>>((acc, t) => {
                      acc[t.label] = (acc[t.label] ?? 0) + t.reviewCount;
                      return acc;
                    }, {})
                )
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 6)
                  .map(([label, count]) => (
                    <span key={label} className="rounded-full bg-zinc-100 px-2.5 py-1 text-xs text-zinc-700">
                      {label} <span className="text-zinc-400">{count}</span>
                    </span>
                  ))
              )}
            </div>
          </RvCard>
          <RvCard className="border-emerald-100 bg-emerald-50/40">
            <h3 className="text-sm font-semibold text-zinc-900">Opportunities for You</h3>
            <ul className="mt-3 space-y-2 text-sm text-zinc-700">
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Increase review velocity to match top 3</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Deliver on speed & value themes customers already praise</li>
              <li className="flex gap-2"><CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" /> Reply faster to protect rating momentum</li>
            </ul>
            <button type="button" className="mt-4 text-sm font-medium text-emerald-600">View full competitor report →</button>
          </RvCard>
        </div>
      </div>

      <ReviewDetailDrawer review={selectedReview} onClose={() => setSelectedReview(null)} />
    </div>
  );
}
