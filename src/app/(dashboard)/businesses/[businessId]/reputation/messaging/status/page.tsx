import { requireBusinessPage } from "@/lib/auth/require-business-page";
import { MessagingPageClient } from "@/components/messaging/messaging-page-client";

export default async function MessagingStatusPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  await requireBusinessPage(businessId);
  return <MessagingPageClient businessId={businessId} screen="status" />;
}
