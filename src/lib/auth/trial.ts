import { createServiceClient } from "@/lib/db/client";
import { isDevMockAuthEnabled } from "@/lib/auth/dev";
import { isSmbLaunchNavEnabled } from "@/lib/product/smb-launch";
import { organizationLooksLikeTrial } from "@/lib/auth/trial-status";

export { organizationLooksLikeTrial } from "@/lib/auth/trial-status";

/**
 * Trial experience for SMB launch:
 * - billing_status "trialing" always counts as trial
 * - SMB starter orgs on "manual" billing (default signup) use the trial dashboard
 *   until billing becomes an active paid subscription
 */
export async function isTrialOrganization(organizationId: string): Promise<boolean> {
  if (!organizationId) return false;
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("organizations")
      .select("plan, billing_status")
      .eq("id", organizationId)
      .maybeSingle();

    return organizationLooksLikeTrial({
      plan: data?.plan,
      billing_status: data?.billing_status,
    });
  } catch (error) {
    if (isDevMockAuthEnabled()) return isSmbLaunchNavEnabled();
    throw error;
  }
}
