import Link from "next/link";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
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
        subtitle="Business-level reputation configuration, alert preferences, and links to QR poster tools."
      />
      <div className="mt-3 space-y-3">
        <ReputationSettingsForm businessId={businessId} />
        <div className="rounded-xl border border-[#E6EAF0] bg-white p-4 shadow-[0_1px_2px_rgba(16,24,40,0.04)]">
          <h2 className="text-sm font-semibold text-[#101828]">QR poster & review link</h2>
          <p className="mt-1 text-sm text-[#667085]">
            Customize the printable QR poster, brand colors, short link, and downloads on the dedicated
            QR Poster page.
          </p>
          <Link
            href={`/businesses/${businessId}/reputation/qr`}
            className="mt-3 inline-flex h-10 items-center justify-center rounded-lg bg-[#137752] px-4 text-sm font-semibold text-white hover:bg-[#0f6244]"
          >
            Open QR Poster
          </Link>
        </div>
        <ReviewAlertSettings businessId={businessId} />
      </div>
    </ModulePage>
  );
}
