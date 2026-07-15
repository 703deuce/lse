import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { ReviewRequestsPanel } from "@/components/reputation/review-requests-panel";
import { ModulePage } from "@/components/ui/design-system";
import { PageHeader } from "@/components/ui/page-header";

export default async function ReviewSettingsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessAccess(businessId);
  const allowed = await hasEntitlement(auth.organizationId, "review_campaigns");
  if (!allowed) return <ReviewCampaignsUpgrade businessId={businessId} />;

  return (
    <ModulePage>
      <PageHeader
        title="Review settings"
        subtitle="Review destination link, poster, and request kit. Alert preferences expand in a later phase."
      />
      <div className="mt-3">
        <ReviewRequestsPanel businessId={businessId} section="poster" hideSubTabs />
      </div>
    </ModulePage>
  );
}
