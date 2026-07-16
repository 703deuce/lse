import { BusinessModuleShell } from "@/components/dashboard/business-module-shell";
import { CitationAuditDashboard } from "@/components/citations/citation-audit-dashboard";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness } from "@/lib/db/queries";
import { notFound } from "next/navigation";

export default async function CitationsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

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
