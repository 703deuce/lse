import { redirect } from "next/navigation";

/** Legacy route — Review Requests consolidated into Review Campaigns. */
export default async function ReviewRequestsRedirectPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businesses/${businessId}/review-campaigns`);
}
