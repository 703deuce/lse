import { createServiceClient } from "@/lib/db/client";

/** Resolve owning organization for an action item via plan → audit → business. */
export async function getActionItemOrganizationId(itemId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data: item } = await supabase
    .from("action_items")
    .select("action_plan_id")
    .eq("id", itemId)
    .maybeSingle();
  if (!item?.action_plan_id) return null;

  const { data: plan } = await supabase
    .from("action_plans")
    .select("audit_id")
    .eq("id", item.action_plan_id)
    .maybeSingle();
  if (!plan?.audit_id) return null;

  const { data: audit } = await supabase
    .from("audits")
    .select("business_id")
    .eq("id", plan.audit_id)
    .maybeSingle();
  if (!audit?.business_id) return null;

  const { data: business } = await supabase
    .from("businesses")
    .select("organization_id")
    .eq("id", audit.business_id)
    .maybeSingle();

  return business?.organization_id ?? null;
}
