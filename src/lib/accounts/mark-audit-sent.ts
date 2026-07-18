import type { createServiceClient } from "@/lib/db/client";

type ServiceClient = ReturnType<typeof createServiceClient>;

/**
 * When a prospect audit is shared/published, advance pipeline to audit_sent
 * without overwriting later stages (proposal_sent / won / lost).
 */
export async function markProspectAuditSent(
  supabase: ServiceClient,
  businessId: string
): Promise<boolean> {
  const { data: business } = await supabase
    .from("businesses")
    .select("id, account_type, prospect_status, archived_at")
    .eq("id", businessId)
    .maybeSingle();

  if (!business || business.archived_at) return false;
  if (business.account_type !== "prospect") return false;

  const status = business.prospect_status as string | null;
  if (status && !["new", "contacted"].includes(status)) return false;

  const { error } = await supabase
    .from("businesses")
    .update({
      prospect_status: "audit_sent",
      updated_at: new Date().toISOString(),
    })
    .eq("id", businessId)
    .eq("account_type", "prospect");

  return !error;
}
