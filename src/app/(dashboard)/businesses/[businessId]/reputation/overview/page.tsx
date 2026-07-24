import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewOverviewDashboard } from "@/components/reviews/review-overview-dashboard";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { loadReviewOverviewData } from "@/lib/reviews/review-overview-data";
import { reviewOverviewPreviewData } from "@/lib/reviews/review-overview-preview-data";

async function ReviewOverviewLoaded({ businessId }: { businessId: string }) {
  const data = isDevPreviewBusiness(businessId)
    ? { ...reviewOverviewPreviewData, businessId }
    : await loadReviewOverviewData(businessId);
  return <ReviewOverviewDashboard businessId={businessId} data={data} />;
}

export default async function ReviewOverviewPage({
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
      <ReviewOverviewLoaded businessId={businessId} />
    </Suspense>
  );
}
