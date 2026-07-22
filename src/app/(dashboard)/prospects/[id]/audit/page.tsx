import { notFound } from "next/navigation";
import { requirePageAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { ProspectAuditDashboard } from "@/components/prospect-audit/prospect-audit-dashboard";
import { buildProspectAuditReport } from "@/lib/prospect-audit/build-report";

export default async function ProspectAuditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: businessId } = await params;
  const auth = await requirePageAuth();
  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, organization_id, account_type, archived_at")
    .eq("id", businessId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (!business || business.archived_at) notFound();

  let initialReport = null;
  try {
    initialReport = await buildProspectAuditReport(businessId);
  } catch {
    initialReport = null;
  }

  return (
    <ProspectAuditDashboard businessId={businessId} initialReport={initialReport} />
  );
}
