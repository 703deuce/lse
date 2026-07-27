import { requireBusinessPageData } from "@/lib/auth/require-business-page";
import { ProspectAuditDashboard } from "@/components/prospect-audit/prospect-audit-dashboard";
import { buildProspectAuditReport } from "@/lib/prospect-audit/build-report";

/**
 * SMB / trial Local SEO Health Assessment.
 * Reuses the prospect-audit engine and report, limited to one keyword,
 * with end-user copy (not consultant → client share language).
 */
export default async function LocalSeoHealthPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  await requireBusinessPageData(businessId);

  let initialReport = null;
  try {
    initialReport = await buildProspectAuditReport(businessId);
  } catch {
    initialReport = null;
  }

  return (
    <ProspectAuditDashboard
      businessId={businessId}
      initialReport={initialReport}
      audience="owner"
    />
  );
}
