import { requirePageAuth } from "@/lib/auth/context";
import { CampaignDetail } from "@/components/campaigns/campaign-detail";

export default async function CampaignPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requirePageAuth();
  const { id } = await params;
  return <CampaignDetail campaignId={id} />;
}
