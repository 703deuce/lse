import { Suspense } from "react";
import { GrowthAuditDashboard } from "@/components/growth-audit/growth-audit-dashboard";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { redirectIfTrialLockedFeature } from "@/lib/auth/redirect-if-trial-locked";
import { Loader2 } from "lucide-react";

export default async function GrowthAuditPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessPageData(businessId);
  await redirectIfTrialLockedFeature(auth.organizationId, "complete-audit");

  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-emerald-600" />
        </div>
      }
    >
      <GrowthAuditDashboard businessId={businessId} />
    </Suspense>
  );
}
