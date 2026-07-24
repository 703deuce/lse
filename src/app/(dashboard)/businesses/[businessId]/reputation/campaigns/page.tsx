import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { ReviewCampaignsHub } from "@/components/reputation/review-campaigns-hub";
import {
  reviewCampaignsPreviewActivity,
  reviewCampaignsPreviewCampaigns,
  reviewCampaignsPreviewStats,
} from "@/lib/reputation/review-campaigns-preview-data";

export default async function ReputationCampaignsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessAccess(businessId);
  const allowed = isPreview || (await hasEntitlement(auth.organizationId, "review_campaigns"));

  if (!allowed) {
    return <ReviewCampaignsUpgrade businessId={businessId} />;
  }

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        </div>
      }
    >
      <ReviewCampaignsHub
        businessId={businessId}
        previewData={
          isPreview
            ? {
                campaigns: reviewCampaignsPreviewCampaigns,
                stats: reviewCampaignsPreviewStats,
                activity: reviewCampaignsPreviewActivity,
              }
            : undefined
        }
      />
    </Suspense>
  );
}
