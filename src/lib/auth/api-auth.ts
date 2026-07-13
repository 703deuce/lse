import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import {
  isDevBypassEnabled,
  isDevPreviewBusiness,
  getDevAuthContext,
} from "@/lib/auth/dev";

export async function requireBusinessAccess(businessId: string): Promise<{
  userId: string;
  organizationId: string;
}> {
  if (
    isDevBypassEnabled() &&
    (process.env.DEV_BYPASS_BUSINESS_ACCESS === "true" || isDevPreviewBusiness(businessId))
  ) {
    const auth = getDevAuthContext();
    return { userId: auth.userId, organizationId: auth.organizationId };
  }

  const auth = await requireAuth();
  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, organization_id")
    .eq("id", businessId)
    .eq("organization_id", auth.organizationId)
    .maybeSingle();

  if (!business) {
    throw new Error("Business not found or access denied");
  }

  return { userId: auth.userId, organizationId: auth.organizationId };
}

export async function requireScanAccess(scanId: string): Promise<{
  organizationId: string;
  businessId: string;
}> {
  const auth = await requireAuth();
  const supabase = createServiceClient();
  const { data: batch } = await supabase.from("scan_batches").select("id, business_id").eq("id", scanId).maybeSingle();
  if (!batch) throw new Error("Scan not found or access denied");

  const { data: business } = await supabase
    .from("businesses")
    .select("organization_id")
    .eq("id", batch.business_id)
    .maybeSingle();

  if (!business || business.organization_id !== auth.organizationId) {
    throw new Error("Scan not found or access denied");
  }

  return { organizationId: auth.organizationId, businessId: batch.business_id };
}
