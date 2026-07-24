import { redirect } from "next/navigation";

export default async function ReviewCampaignsRedirectPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  redirect(`/businesses/${businessId}/reputation/campaigns`);
}
