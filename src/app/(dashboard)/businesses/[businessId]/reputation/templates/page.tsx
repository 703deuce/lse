import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { TemplatesHub } from "@/components/reputation/templates-hub";
import {
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

  return (
    <TemplatesHub
      businessId={businessId}
      initialTemplates={isPreview ? reputationTemplatesPreviewData : undefined}
      previewKpis={isPreview ? reputationTemplatesPreviewKpis : undefined}
    />
  );
}
