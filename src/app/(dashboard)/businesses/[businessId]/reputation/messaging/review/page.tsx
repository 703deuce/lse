import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { MessagingPageClient } from "@/components/messaging/messaging-page-client";

export default async function MessagingReviewPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  await requireBusinessAccess(businessId);
  return <MessagingPageClient businessId={businessId} screen="review" />;
}
