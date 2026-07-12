import { ReviewRequestsDashboard } from "@/components/reputation/review-requests-dashboard";

export default async function ReviewRequestsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <ReviewRequestsDashboard businessId={businessId} />;
}
