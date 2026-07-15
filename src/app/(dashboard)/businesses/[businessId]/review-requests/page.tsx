import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { ReviewRequestsDashboard } from "@/components/reputation/review-requests-dashboard";

/** Review Requests kit (poster, templates, quick send, tracking). Campaigns are nested nav. */
export default async function ReviewRequestsPage({
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
      <ReviewRequestsDashboard businessId={businessId} />
    </Suspense>
  );
}
