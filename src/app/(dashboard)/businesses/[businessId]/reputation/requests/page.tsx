import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewRequestsDashboard } from "@/components/reputation/review-requests-dashboard";
import { ReviewRequestsUpgrade } from "@/components/reputation/review-requests-upgrade";

export default async function ReputationRequestsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessAccess(businessId);
  const allowed = await hasEntitlement(auth.organizationId, "review_campaigns");

  if (!allowed) {
    return <ReviewRequestsUpgrade businessId={businessId} />;
  }

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
