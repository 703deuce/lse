import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { hasEntitlement } from "@/lib/auth/entitlements";
import { ReviewCampaignsUpgrade } from "@/components/reputation/review-campaigns-upgrade";
import { TemplatesManager } from "@/components/reputation/templates-manager";
import { ModuleHeader, ModulePage } from "@/components/ui/design-system";
import { FileText } from "lucide-react";

export default async function ReviewTemplatesPage({
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
      <ModuleHeader
        icon={<FileText className="h-5 w-5 shrink-0 text-emerald-600" />}
        title="Templates"
        subtitle="Create, edit, and test SMS/email templates. Tracked {{review_link}} tokens redirect through /r/ then to Google."
      />
      <div className="mt-3">
        <TemplatesManager businessId={businessId} />
      </div>
    </ModulePage>
  );
}
