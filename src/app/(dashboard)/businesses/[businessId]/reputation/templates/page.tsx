import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { getBusiness } from "@/lib/db/queries";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { TemplatesHub } from "@/components/reputation/templates-hub";
import {
  REPUTATION_PREVIEW_BUSINESS_NAME,
  reputationTemplatesPreviewData,
  reputationTemplatesPreviewKpis,
} from "@/lib/reputation/reputation-page-preview-data";

export default async function ReputationTemplatesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const isPreview = isDevPreviewBusiness(businessId);
  const auth = await requireBusinessAccess(businessId);
  const allowed = isPreview || (await hasEntitlement(auth.organizationId, "review_campaigns"));
  if (!allowed) return <ReviewCampaignsUpgrade businessId={businessId} />;

  const business = isPreview
    ? null
    : await getBusiness(businessId, auth.organizationId);
  const businessName =
    business?.name?.trim() ||
    (isPreview ? REPUTATION_PREVIEW_BUSINESS_NAME : "your business");

  return (
    <TemplatesHub
      businessId={businessId}
      businessName={businessName}
      initialTemplates={isPreview ? reputationTemplatesPreviewData : undefined}
      previewKpis={isPreview ? reputationTemplatesPreviewKpis : undefined}
    />
  );
}
