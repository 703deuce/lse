"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CheckCircle2, Circle } from "lucide-react";
import type { ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import { mock } from "@/components/mockup/ui";
import { StarRating } from "@/components/reviews/reviews-ui";

function competitorBlurb(reviewCount: number): string {
  if (reviewCount >= 10) {
    return "very popular and above average for your industry.";
  }
  if (reviewCount >= 5) {
    return "doing well and about average for your market.";
  }
  return "getting started and below average for review volume.";
}

type Props = {
  data: ReviewsPageData;
  businessId: string;
};

export function ReviewsCompetitorTab({ data, businessId }: Props) {
  const competitorsHref = `/businesses/${businessId}/reputation/competitors`;
  const competitors = data.competitors ?? [];
  const [filter, setFilter] = useState<"all" | string>("all");

  const filtered = useMemo(() => {
    if (filter === "all") return competitors;
    return competitors.filter((c) => c.id === filter);
  }, [competitors, filter]);

  const themePills = useMemo(() => {
    const fromKeywords = data.competitorWinningKeywords?.slice(0, 6) ?? [];
    if (fromKeywords.length > 0) {
      return fromKeywords.map((t) => ({ label: t.keyword, count: t.count }));
    }
    const fromThemes = data.sentiment?.yours?.themes?.slice(0, 6) ?? [];
    if (fromThemes.length > 0) {
      return fromThemes.map((t) => ({ label: t.label, count: t.reviewCount }));
    }
    return [];
  }, [data.competitorWinningKeywords, data.sentiment]);

  const insights = useMemo(() => {
    const items: string[] = [];
    const yourReviews = data.kpis.totalReviews;
    const topCompetitor = competitors.reduce(
      (best, c) => Math.max(best, c.totalReviews ?? c.newReviews90d ?? 0),
      0
    );
    if (topCompetitor > 0 && yourReviews < topCompetitor) {
      items.push(`Top competitor has about ${topCompetitor - yourReviews} more reviews than you.`);
    }
    if (competitors.length === 0) {
      items.push("Add competitors to compare review volume and themes.");
    } else if (competitors.every((c) => (c.newReviews90d ?? 0) === 0)) {
      items.push("Competitor velocity is flat in the loaded window — keep collecting your own reviews.");
    }
    if (data.kpis.unanswered90d > 0) {
      items.push(`${data.kpis.unanswered90d} of your reviews still need a response.`);
    }
    return items.slice(0, 3);
  }, [competitors, data.kpis.totalReviews, data.kpis.unanswered90d]);

  const opportunities = useMemo(() => {
    const items: string[] = [];
    if (data.kpis.newReviews90d < 5) {
      items.push("Increase review volume over the next 90 days with after-service requests.");
    }
    const recentNegatives = (data.yourReviews ?? []).filter((r) => (r.rating ?? 5) <= 2).length;
    if (recentNegatives > 0 || data.kpis.urgentCount > 0) {
      items.push("Respond quickly to recent negative reviews to protect local conversion.");
    }
    if (themePills.length > 0) {
      items.push(`Lean into themes competitors win on: ${themePills.slice(0, 2).map((t) => t.label).join(", ")}.`);
    }
    if (!items.length) {
      items.push("Keep a steady review cadence and reply to every text review.");
    }
    return items.slice(0, 3);
  }, [data.kpis.newReviews90d, data.kpis.urgentCount, data.yourReviews, themePills]);

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <label className="flex items-center gap-2 text-[13px] text-[#64748B]">
          <span className="font-medium">Competitors</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="rounded-lg border border-[#E6EAF0] bg-white px-3 py-1.5 text-[13px] font-semibold text-[#0F172A] outline-none focus:border-[#137752]"
          >
            <option value="all">All Competitors ({competitors.length})</option>
            {competitors.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className={`${mock.card} p-5`}>
          <h3 className="text-[16px] font-bold text-[#0F172A]">
            Competitor Reviewing Analysis (Off-site)
          </h3>

          <div className="mt-4 space-y-0 divide-y divide-[#EEF1F5]">
            {filtered.length === 0 ? (
              <p className="py-8 text-center text-[13px] text-[#64748B]">
                No competitor review data yet. Add competitors from your workspace to compare.
              </p>
            ) : (
              filtered.map((comp) => {
                const count = comp.newReviews90d ?? comp.totalReviews ?? 0;
                const rating = comp.avgRating ?? comp.rating ?? 5;
                return (
                  <div key={comp.id} className="py-4 first:pt-2">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-[15px] font-bold text-[#0F172A]">{comp.name}</p>
                        <div className="mt-1.5 flex flex-wrap items-center gap-3">
                          <StarRating rating={rating} />
                          <span className="text-[12px] text-[#64748B]">
                            {count} reviews (30 days)
                          </span>
                          <Link
                            href={competitorsHref}
                            className="text-[12px] font-semibold text-[#137752] hover:underline"
                          >
                            View Reviews
                          </Link>
                        </div>
                        <p className="mt-2 text-[13px] leading-relaxed text-[#64748B]">
                          {comp.name} is {competitorBlurb(count)}
                        </p>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <Link
            href={competitorsHref}
            className="mt-2 inline-block text-[13px] font-semibold text-[#137752] hover:underline"
          >
            View all competitor reviews details →
          </Link>
        </div>

        <aside className="space-y-4">
          <div className={`${mock.card} p-4`}>
            <h3 className="text-[14px] font-bold text-[#0F172A]">Top Insights</h3>
            <ul className="mt-3 space-y-2.5">
              {insights.length ? (
                insights.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-[13px] text-[#0F172A]">
                    <Circle className="mt-0.5 h-4 w-4 shrink-0 text-[#94A3B8]" />
                    <span>{item}</span>
                  </li>
                ))
              ) : (
                <li className="text-[13px] text-[#64748B]">No competitor insights yet. Sync reviews to compare.</li>
              )}
            </ul>
          </div>

          <div className={`${mock.card} p-4`}>
            <h3 className="text-[14px] font-bold text-[#0F172A]">Common Product Themes</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              {themePills.length ? (
                themePills.map((t) => (
                  <span
                    key={t.label}
                    className="rounded-full bg-[#F1F5F9] px-2.5 py-1 text-[11px] font-medium text-[#475569]"
                  >
                    {t.label} ({t.count})
                  </span>
                ))
              ) : (
                <p className="text-[13px] text-[#64748B]">Themes appear after competitor review text is analyzed.</p>
              )}
            </div>
          </div>

          <div className={`${mock.card} p-4`}>
            <h3 className="text-[14px] font-bold text-[#0F172A]">Opportunities for You</h3>
            <ul className="mt-3 space-y-2.5">
              {opportunities.map((item) => (
                <li key={item} className="flex items-start gap-2.5 text-[13px] text-[#0F172A]">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#137752]" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
            <Link
              href={competitorsHref}
              className="mt-3 inline-block text-[13px] font-semibold text-[#137752] hover:underline"
            >
              View all competitor reports →
            </Link>
          </div>
        </aside>
      </div>
    </div>
  );
}
