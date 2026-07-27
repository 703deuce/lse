import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { redirectIfTrialLockedFeature } from "@/lib/auth/redirect-if-trial-locked";
import { BusinessCampaignsClient } from "@/components/campaigns/business-campaigns-client";

export default async function BusinessCampaignsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessPage(businessId);
  await redirectIfTrialLockedFeature(auth.organizationId, "keywords");
  return <BusinessCampaignsClient businessId={businessId} />;
}
