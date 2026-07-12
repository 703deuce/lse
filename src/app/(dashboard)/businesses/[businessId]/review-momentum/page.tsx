import { ReviewMomentumDashboard } from "@/components/reviews/review-momentum-dashboard";

export default async function ReviewMomentumPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <ReviewMomentumDashboard businessId={businessId} />;
}
