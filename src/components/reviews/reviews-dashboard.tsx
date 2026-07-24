"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, Search, Sparkles } from "lucide-react";
import { ModulePage, AlertBanner } from "@/components/ui/design-system";
import { PageHeader } from "@/components/ui/page-header";
import { ReviewDetailDrawer } from "@/components/reviews/review-detail-drawer";
import {
  ReviewStatusBadge,
  ReviewerAvatar,
  SourceIcon,
  StarRating,
} from "@/components/reviews/reviews-ui";
import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import { useModuleJobRunner } from "@/components/jobs/use-module-job-runner";
import { cn } from "@/lib/utils";

type ScopeFilter = "all" | "yours" | "competitors";
type ResponseFilter = "all" | "unanswered" | "replied" | "resolved";
type RatingFilter = "all" | "5" | "4" | "3" | "2" | "1";
type DateFilter = "all" | "7" | "30" | "60" | "90";

function withinDays(iso: string | null, days: number): boolean {
  if (!iso) return false;
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return false;
  return Date.now() - then <= days * 24 * 60 * 60 * 1000;
}

export function ReviewsDashboard({ businessId }: { businessId: string }) {
  const [data, setData] = useState<ReviewsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [scope, setScope] = useState<ScopeFilter>("all");
  const [response, setResponse] = useState<ResponseFilter>("all");
  const [rating, setRating] = useState<RatingFilter>("all");
  const [dateRange, setDateRange] = useState<DateFilter>("90");
  const [businessFilter, setBusinessFilter] = useState<string>("all");
  const [selected, setSelected] = useState<ReviewListItem | null>(null);
  const [visibleCount, setVisibleCount] = useState(25);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/reviews/${businessId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Failed to load reviews");
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Load failed");
    } finally {
      setLoading(false);
    }
  }, [businessId]);

  useEffect(() => {
    void load();
  }, [load]);

  const {
    start: startJob,
    running,
    error,
    setError,
  } = useModuleJobRunner({
    onSettled: () => load(),
  });

  const runMomentum = async () => {
    try {
      await startJob("/api/reviews/momentum/run", { businessId }, "Run failed");
    } catch {
      /* runner sets error */
    }
  };

  const businessOptions = useMemo(() => {
    if (!data) return [];
    const names = new Map<string, string>();
    names.set("you", data.businessName);
    for (const row of data.stream) {
      if (!row.isTarget) names.set(row.competitorId ?? row.businessName, row.businessName);
    }
    return Array.from(names.entries()).map(([id, name]) => ({ id, name }));
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    return data.stream.filter((row) => {
      if (scope === "yours" && !row.isTarget) return false;
      if (scope === "competitors" && row.isTarget) return false;
      if (response === "unanswered" && (row.replied || row.resolved)) return false;
      if (response === "replied" && !row.replied) return false;
      if (response === "resolved" && !row.resolved) return false;
      if (rating !== "all" && row.rating !== Number(rating)) return false;
      if (dateRange !== "all" && !withinDays(row.publishedAt ?? row.reviewDate, Number(dateRange))) {
        return false;
      }
      if (businessFilter === "you" && !row.isTarget) return false;
      if (businessFilter !== "all" && businessFilter !== "you") {
        const key = row.competitorId ?? row.businessName;
        if (key !== businessFilter) return false;
      }
      if (search.trim()) {
        const q = search.toLowerCase();
        const hay = `${row.reviewerName} ${row.reviewText ?? ""} ${row.businessName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, scope, response, rating, dateRange, businessFilter, search]);

  useEffect(() => {
    setVisibleCount(25);
  }, [scope, response, rating, dateRange, businessFilter, search]);

  const visible = filtered.slice(0, visibleCount);

  const patchReview = useCallback((next: ReviewListItem) => {
    setData((prev) => {
      if (!prev) return prev;
      const patch = (rows: ReviewListItem[]) => rows.map((r) => (r.id === next.id ? next : r));
      return {
        ...prev,
        stream: patch(prev.stream),
        yourReviews: patch(prev.yourReviews),
        competitorReviews: patch(prev.competitorReviews),
        unanswered: patch(prev.unanswered).filter((r) => !r.replied && !r.resolved),
      };
    });
    setSelected((cur) => (cur?.id === next.id ? next : cur));
  }, []);

  if (loading && !data) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-3.5 text-center">
        <p className="text-[13px] text-red-800">{error}</p>
        <button type="button" onClick={() => void load()} className="mt-2.5 text-[13px] font-medium text-emerald-600">
          Try again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <ModulePage wide>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <PageHeader
          title="Review Feed"
          subtitle="Read, reply, and resolve individual reviews. Charts and forecasting live in Analytics and Insights."
        />
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={loading || running}
            onClick={() => void load()}
            className="rounded-md border border-zinc-200 bg-white px-2.5 py-1.5 text-[12px] font-medium text-zinc-700 hover:bg-zinc-50 disabled:opacity-60"
          >
            Refresh
          </button>
          <button
            type="button"
            disabled={running}
            onClick={() => void runMomentum()}
            className="inline-flex items-center gap-1.5 rounded-full bg-[#137752] px-3 py-1.5 text-[12px] font-semibold text-white hover:bg-[#0f6344] disabled:opacity-60"
          >
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            Sync reviews
          </button>
        </div>
      </div>

      {error ? <AlertBanner variant="error">{error}</AlertBanner> : null}

      {data.syncState.needsRun ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
          {data.syncState.message}{" "}
          <button type="button" onClick={() => void runMomentum()} className="font-semibold text-emerald-700 underline">
            Sync now
          </button>
        </div>
      ) : null}

      <div className="rounded-xl border border-zinc-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search review text…"
              className="h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 text-[13px] outline-none focus:border-[#137752]"
            />
          </div>
          <select
            value={scope}
            onChange={(e) => setScope(e.target.value as ScopeFilter)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-2.5 text-[12px]"
          >
            <option value="all">Customer + competitor</option>
            <option value="yours">Your reviews</option>
            <option value="competitors">Competitor reviews</option>
          </select>
          <select
            value={rating}
            onChange={(e) => setRating(e.target.value as RatingFilter)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-2.5 text-[12px]"
          >
            <option value="all">All ratings</option>
            <option value="5">5 stars</option>
            <option value="4">4 stars</option>
            <option value="3">3 stars</option>
            <option value="2">2 stars</option>
            <option value="1">1 star</option>
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateFilter)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-2.5 text-[12px]"
          >
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="60">Last 60 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All dates</option>
          </select>
          <select
            value={businessFilter}
            onChange={(e) => setBusinessFilter(e.target.value)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-2.5 text-[12px]"
          >
            <option value="all">All businesses</option>
            <option value="you">You · {data.businessName}</option>
            {businessOptions
              .filter((b) => b.id !== "you")
              .map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
          </select>
          <select
            value={response}
            onChange={(e) => setResponse(e.target.value as ResponseFilter)}
            className="h-9 rounded-md border border-zinc-200 bg-white px-2.5 text-[12px]"
          >
            <option value="all">Any response status</option>
            <option value="unanswered">Unanswered</option>
            <option value="replied">Owner responded</option>
            <option value="resolved">Marked resolved</option>
          </select>
        </div>
        <p className="mt-2 text-[12px] text-zinc-500">
          Showing {visible.length} of {filtered.length} reviews
          {filtered.filter((r) => r.isNew).length > 0
            ? ` · ${filtered.filter((r) => r.isNew).length} new`
            : ""}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm">
        {visible.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <CheckCircle2 className="mx-auto h-8 w-8 text-[#137752]" />
            <p className="mt-3 text-[14px] font-semibold text-zinc-900">No reviews match these filters</p>
            <p className="mt-1 text-[13px] text-zinc-500">Widen the date range or clear search to see more.</p>
          </div>
        ) : (
          <ul className="divide-y divide-zinc-100">
            {visible.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => setSelected(row)}
                  className="flex w-full items-start gap-3 px-4 py-3.5 text-left hover:bg-zinc-50"
                >
                  <ReviewerAvatar name={row.reviewerName} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-[13px] font-semibold text-zinc-900">{row.reviewerName}</p>
                      {row.isNew ? (
                        <span className="rounded-full bg-sky-50 px-2 py-0.5 text-[10px] font-semibold text-sky-700 ring-1 ring-sky-100">
                          New
                        </span>
                      ) : null}
                      <ReviewStatusBadge replied={row.replied} variant="pill" />
                      {row.resolved ? (
                        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-semibold text-zinc-600">
                          Resolved
                        </span>
                      ) : null}
                      {!row.isTarget ? (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">
                          Competitor
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-[12px] text-zinc-500">
                      <StarRating rating={row.rating} size="sm" />
                      <SourceIcon source={row.source} />
                      <span>{row.businessName}</span>
                      <span>·</span>
                      <span>{row.relativeDate ?? "Unknown date"}</span>
                    </div>
                    <p className="mt-1.5 line-clamp-2 text-[13px] leading-snug text-zinc-700">
                      {row.reviewText?.trim() || "No review text provided."}
                    </p>
                    {row.ownerResponseText ? (
                      <p className="mt-1.5 line-clamp-1 text-[12px] text-emerald-700">
                        Owner response: {row.ownerResponseText}
                      </p>
                    ) : null}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
        {visibleCount < filtered.length ? (
          <div className="border-t border-zinc-100 px-4 py-3 text-center">
            <button
              type="button"
              onClick={() => setVisibleCount((n) => n + 25)}
              className={cn("text-[13px] font-semibold text-[#137752] hover:underline")}
            >
              Load more
            </button>
          </div>
        ) : null}
      </div>

      <ReviewDetailDrawer
        review={selected}
        businessId={businessId}
        onClose={() => setSelected(null)}
        onUpdated={patchReview}
      />
    </ModulePage>
  );
}
