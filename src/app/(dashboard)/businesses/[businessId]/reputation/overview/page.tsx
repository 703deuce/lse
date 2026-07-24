import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewOverviewDashboard } from "@/components/reviews/review-overview-dashboard";
import { reviewOverviewPreviewData } from "@/lib/reviews/review-overview-preview-data";

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
      <ReviewOverviewDashboard businessId={businessId} data={reviewOverviewPreviewData} />
    </Suspense>
  );
}
