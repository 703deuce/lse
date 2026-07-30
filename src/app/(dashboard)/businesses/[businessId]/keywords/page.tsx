import { KeywordTrackerDashboard } from "@/components/keyword-tracker/keyword-dashboard";
import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { redirectIfTrialLockedFeature } from "@/lib/auth/redirect-if-trial-locked";

export default async function KeywordsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessPage(businessId);
  await redirectIfTrialLockedFeature(auth.organizationId, "keywords");
  return <KeywordTrackerDashboard businessId={businessId} />;
}
