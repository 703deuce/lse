import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { CampaignDetailClient } from "@/components/reputation/campaign-detail-client";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; campaignId: string }>;
}) {
  const { businessId, campaignId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  const allowed = await hasEntitlement(auth.organizationId, "review_campaigns");
  if (!allowed) return <ReviewCampaignsUpgrade businessId={businessId} />;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-[320px] items-center justify-center">
          <Loader2 className="h-7 w-7 animate-spin text-emerald-600" />
        </div>
      }
    >
      <CampaignDetailClient businessId={businessId} campaignId={campaignId} />
    </Suspense>
  );
}
