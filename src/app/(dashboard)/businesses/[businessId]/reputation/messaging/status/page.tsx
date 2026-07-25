import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { MessagingPageClient } from "@/components/messaging/messaging-page-client";

export default async function MessagingStatusPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  await requireBusinessAccess(businessId);
  return <MessagingPageClient businessId={businessId} screen="status" />;
}
