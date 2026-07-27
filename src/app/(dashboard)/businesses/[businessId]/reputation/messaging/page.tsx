import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { redirectIfTrialLockedFeature } from "@/lib/auth/redirect-if-trial-locked";
import { getBusiness } from "@/lib/db/queries";
import { MessagingPageClient } from "@/components/messaging/messaging-page-client";

export default async function MessagingOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessPage(businessId);
  await redirectIfTrialLockedFeature(auth.organizationId, "messaging");
  await getBusiness(businessId, auth.organizationId);

  return <MessagingPageClient businessId={businessId} screen="overview" />;
}
