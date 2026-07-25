import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getBusiness } from "@/lib/db/queries";
import { MessagingPageClient } from "@/components/messaging/messaging-page-client";

export default async function MessagingOverviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireBusinessAccess(businessId);
  await getBusiness(businessId, auth.organizationId);

  return <MessagingPageClient businessId={businessId} screen="overview" />;
}
