import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewsDashboard } from "@/components/reviews/reviews-dashboard";

export default async function ReputationReviewsPage({
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
      <ReviewsDashboard businessId={businessId} />
    </Suspense>
  );
}
