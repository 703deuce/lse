import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { ReviewRequestsPanel } from "@/components/reputation/review-requests-panel";
import { ReviewAlertSettings } from "@/components/reputation/review-alert-settings";
import { ReputationSettingsForm } from "@/components/reputation/reputation-settings-form";
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
        subtitle="Business-level reputation configuration, review link and QR settings, and alert preferences."
      />
      <div className="mt-3 space-y-3">
        <ReputationSettingsForm businessId={businessId} />
        <ReviewRequestsPanel businessId={businessId} section="poster" hideSubTabs />
        <ReviewAlertSettings businessId={businessId} />
      </div>
    </ModulePage>
  );
}
