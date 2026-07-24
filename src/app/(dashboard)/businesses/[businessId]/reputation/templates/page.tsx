import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { TemplatesHub } from "@/components/reputation/templates-hub";

export default async function ReputationTemplatesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessAccess(businessId);
  const allowed = await hasEntitlement(auth.organizationId, "review_campaigns");
  if (!allowed) return <ReviewCampaignsUpgrade businessId={businessId} />;

  return <TemplatesHub businessId={businessId} />;
}
