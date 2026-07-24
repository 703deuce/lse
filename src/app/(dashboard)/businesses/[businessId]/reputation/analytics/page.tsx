import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewAnalyticsDashboard } from "@/components/reviews/review-analytics-dashboard";
import { ReputationEmptySyncState } from "@/components/reputation/reputation-sync-button";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { loadReviewAnalyticsData } from "@/lib/reviews/review-analytics-data";
import { reviewAnalyticsPreviewData } from "@/lib/reviews/review-analytics-preview-data";

async function ReviewAnalyticsLoaded({ businessId }: { businessId: string }) {
  if (isDevPreviewBusiness(businessId)) {
    return (
      <ReviewAnalyticsDashboard
        businessId={businessId}
        data={{ ...reviewAnalyticsPreviewData, businessId } as typeof reviewAnalyticsPreviewData}
      />
    );
  }

  try {
    const live = await loadReviewAnalyticsData(businessId);
    const hasTimeline = live.timelinePoints.some((point) => point.you > 0 || point.competitorAvg > 0);
    if (!hasTimeline) {
      return (
        <ReputationEmptySyncState
          businessId={businessId}
          title="No review analytics yet"
          description="Run one reputation sync to fetch your Google reviews and competitor velocity. Analytics, Feed, Competitors, and Insights all fill from that same run."
        />
      );
    }
    return <ReviewAnalyticsDashboard businessId={businessId} data={live} />;
  } catch (err) {
    return (
      <ReputationEmptySyncState
        businessId={businessId}
        title="Couldn’t load analytics"
        description={err instanceof Error ? err.message : "Refresh reputation data and try again."}
      />
    );
  }
}

export default async function ReputationAnalyticsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[400px] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <ReviewAnalyticsLoaded businessId={businessId} />
    </Suspense>
  );
}
