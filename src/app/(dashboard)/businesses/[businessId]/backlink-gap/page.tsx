import { BacklinkGapDashboard } from "@/components/backlink-gap/backlink-gap-dashboard";

export default async function BacklinkGapPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  return <BacklinkGapDashboard businessId={businessId} />;
}
