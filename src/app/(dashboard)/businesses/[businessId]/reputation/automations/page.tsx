import { AutomationsHub } from "@/components/reputation/automations-hub";
import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { isDevPreviewBusiness } from "@/lib/auth/dev";
import { reputationAutomationsPreviewData } from "@/lib/reputation/reputation-page-preview-data";

export default async function ReputationAutomationsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  await requireBusinessPage(businessId);
  const isPreview = isDevPreviewBusiness(businessId);
  return (
    <AutomationsHub
      businessId={businessId}
      previewData={isPreview ? reputationAutomationsPreviewData : undefined}
    />
  );
}
