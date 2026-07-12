import { BusinessModuleShell } from "@/components/dashboard/business-module-shell";
import { CitationAuditDashboard } from "@/components/citations/citation-audit-dashboard";

export default async function CitationsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;

  return (
    <BusinessModuleShell
      businessId={businessId}
      title="Citation Audit"
      subtitle="Find missing listings, NAP issues, and competitor citation gaps."
    >
      <CitationAuditDashboard businessId={businessId} />
    </BusinessModuleShell>
  );
}
