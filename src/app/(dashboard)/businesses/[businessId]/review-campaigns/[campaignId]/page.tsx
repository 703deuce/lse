import { redirect } from "next/navigation";

export default async function ReviewCampaignDetailRedirectPage({
  params,
}: {
  params: Promise<{ businessId: string; campaignId: string }>;
}) {
  const { businessId, campaignId } = await params;
  redirect(`/businesses/${businessId}/reputation/campaigns/${campaignId}`);
}
