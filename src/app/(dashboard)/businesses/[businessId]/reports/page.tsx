import { ReportsHub } from "@/components/reports/reports-hub";
import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { getLatestScan } from "@/lib/db/queries";
import type { ReportType } from "@/lib/reporting/types";

const REPORT_TYPES = new Set<ReportType>([
  "single_scan",
  "competitor",
  "trend",
  "location",
  "keyword",
  "maps_campaign",
  "reviews",
  "review_campaign",
]);

export default async function ReportsPage({
  params,
  searchParams,
}: {
  params: Promise<{ businessId: string }>;
  searchParams: Promise<{ type?: string; campaignId?: string }>;
}) {
  const { businessId } = await params;
  const sp = await searchParams;
  await requireBusinessPageData(businessId);
  const latestScan = await getLatestScan(businessId);
  const initialType =
    sp.type && REPORT_TYPES.has(sp.type as ReportType)
      ? (sp.type as ReportType)
      : undefined;

  return (
    <ReportsHub
      businessId={businessId}
      latestScanId={latestScan?.id ?? null}
      initialType={initialType}
      initialMapsCampaignId={sp.campaignId ?? null}
    />
  );
}
