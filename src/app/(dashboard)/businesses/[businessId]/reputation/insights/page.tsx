import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewInsightsDashboard } from "@/components/reviews/review-insights-dashboard";
import { loadReviewInsightsData } from "@/lib/reviews/review-insights-data";

async function ReviewInsightsLoaded({ businessId }: { businessId: string }) {
  const data = await loadReviewInsightsData(businessId);
  return <ReviewInsightsDashboard businessId={businessId} data={data} />;
}

export default async function ReputationInsightsPage({
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
      <ReviewInsightsLoaded businessId={businessId} />
    </Suspense>
  );
}
