import { ReportsPanel } from "@/components/reports/reports-panel";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness, getLatestScan } from "@/lib/db/queries";
import { notFound } from "next/navigation";

export default async function ReportsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();
  const latestScan = await getLatestScan(businessId);

  return (
    <ReportsPanel businessId={businessId} latestScanId={latestScan?.id ?? null} />
  );
}
