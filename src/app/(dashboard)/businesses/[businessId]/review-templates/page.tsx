import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { TemplatesManager } from "@/components/reputation/templates-manager";
import { ModulePage } from "@/components/ui/design-system";
import { PageHeader } from "@/components/ui/page-header";

export default async function ReviewTemplatesPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  const allowed = await hasEntitlement(auth.organizationId, "review_campaigns");
  if (!allowed) return <ReviewCampaignsUpgrade businessId={businessId} />;

  return (
    <ModulePage>
      <PageHeader
        title="Templates"
        subtitle="Create, edit, and test SMS/email templates. Tracked {{review_link}} tokens redirect through /r/ then to Google."
      />
      <div className="mt-3">
        <TemplatesManager businessId={businessId} />
      </div>
    </ModulePage>
  );
}
