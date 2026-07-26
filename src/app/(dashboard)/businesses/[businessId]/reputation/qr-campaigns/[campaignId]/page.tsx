import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { QrCampaignEditor } from "@/components/reputation/qr-campaigns/qr-campaign-editor";
import { ReviewRequestsUpgrade } from "@/components/reputation/review-requests-upgrade";

export default async function QrCampaignEditorPage({
  params,
}: {
  params: Promise<{ businessId: string; campaignId: string }>;
}) {
  const { businessId, campaignId } = await params;
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessAccess(businessId);
  const allowed =
    isPreview ||
    (await hasEntitlement(auth.organizationId, "review_requests")) ||
    (await hasEntitlement(auth.organizationId, "review_campaigns"));

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
      <QrCampaignEditor businessId={businessId} campaignId={campaignId} />
    </Suspense>
  );
}
