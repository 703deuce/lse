import { ReportsHub } from "@/components/reports/reports-hub";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { getLatestScan } from "@/lib/db/queries";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  await requireBusinessPageData(businessId);
  const latestScan = await getLatestScan(businessId);

  return <ReportsHub businessId={businessId} latestScanId={latestScan?.id ?? null} />;
}
