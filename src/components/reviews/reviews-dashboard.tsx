"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { ModulePage, AlertBanner } from "@/components/ui/design-system";
import { ReviewsCompetitorTab } from "@/components/reviews/reviews-competitor-tab";
import { ReviewsSentimentTab } from "@/components/reviews/reviews-sentiment-tab";
import { ReviewsUnansweredTab } from "@/components/reviews/reviews-unanswered-tab";
import { ReviewsYourTab } from "@/components/reviews/reviews-your-tab";
import {
  REVIEWS_TABS,
  ReviewsHeader,
  ReviewsKpiRow,
  ReviewsTabs,
  SuggestedActionsSidebar,
  SuggestedReplyTasksSidebar,
  type ReviewsTabId,
} from "@/components/reviews/reviews-ui";
import type { ReviewsPageData } from "@/lib/reviews/reviews-page-data";
import { useModuleJobRunner } from "@/components/jobs/use-module-job-runner";

function parseTab(value: string | null): ReviewsTabId {
  if (value === "overview") return "your-reviews";
  if (value === "keywords") return "sentiment";
  if (value && REVIEWS_TABS.some((t) => t.id === value)) return value as ReviewsTabId;
  return "your-reviews";
}

export function ReviewsDashboard({ businessId }: { businessId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tab, setTab] = useState<ReviewsTabId>(() => parseTab(searchParams.get("tab")));
  const [data, setData] = useState<ReviewsPageData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  const handleTabChange = useCallback(
    (next: ReviewsTabId) => {
      setTab(next);
      const params = new URLSearchParams(searchParams.toString());
      params.set("tab", next);
      router.replace(`/businesses/${businessId}/reviews?${params.toString()}`, { scroll: false });
    },
    [businessId, router, searchParams]
  );

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
      /* error already set by runner */
    }
  };

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
      <ReviewsHeader
        businessId={businessId}
        loading={loading || running}
        onRefresh={() => void load()}
        onRunMomentum={() => void runMomentum()}
      />

      {error && <AlertBanner variant="error">{error}</AlertBanner>}

      {data.syncState.needsRun && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[13px] text-amber-900">
          {data.syncState.message}{" "}
          <button type="button" onClick={() => void runMomentum()} className="font-semibold text-emerald-700 underline">
            Run Review Momentum
          </button>
        </div>
      )}

      <ReviewsKpiRow kpis={data.kpis} variant={tab === "unanswered" ? "unanswered" : "default"} />

      <ReviewsTabs active={tab} onChange={handleTabChange} />

      {tab === "your-reviews" && (
        <ReviewsYourTab data={data} />
      )}

      {tab === "competitor-reviews" && <ReviewsCompetitorTab data={data} />}
      {tab === "sentiment" && <ReviewsSentimentTab data={data} />}
      {tab === "unanswered" && <ReviewsUnansweredTab data={data} businessId={businessId} />}

      <div className="grid gap-2 xl:grid-cols-2">
        <SuggestedActionsSidebar suggestions={data.suggestions} businessId={businessId} onTabChange={handleTabChange} />
        <SuggestedReplyTasksSidebar
          data={data}
          businessId={businessId}
          onTabChange={handleTabChange}
        />
      </div>
    </ModulePage>
  );
}
