import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewAnalyticsDashboard } from "@/components/reviews/review-analytics-dashboard";
import { loadReviewAnalyticsData } from "@/lib/reviews/review-analytics-data";

async function ReviewAnalyticsLoaded({ businessId }: { businessId: string }) {
  const data = await loadReviewAnalyticsData(businessId);
  return <ReviewAnalyticsDashboard businessId={businessId} data={data} />;
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
