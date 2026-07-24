import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { ReviewRequestsPanel } from "@/components/reputation/review-requests-panel";
import { ReviewAlertSettings } from "@/components/reputation/review-alert-settings";
import { ModulePage } from "@/components/ui/design-system";
import { PageHeader } from "@/components/ui/page-header";

export default async function ReputationSettingsPage({
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
        title="Reputation Settings"
        subtitle="Review destination link, poster kit, alert preferences, and location configuration."
      />
      <div className="mt-3 space-y-3">
        <ReviewRequestsPanel businessId={businessId} section="poster" hideSubTabs />
        <ReviewAlertSettings businessId={businessId} />
      </div>
    </ModulePage>
  );
}
