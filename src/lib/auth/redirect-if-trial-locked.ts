import { redirect } from "next/navigation";
import { isTrialOrganization } from "@/lib/auth/trial";
import { isSmbLaunchNavEnabled } from "@/lib/product/smb-launch";

/**
 * During SMB trial, paid menu items stay visible but must not be usable.
 * Redirect locked features to billing with an upgrade hint.
 */
export async function redirectIfTrialLockedFeature(
  organizationId: string,
  feature: "campaigns" | "keywords" | "complete-audit" | "messaging"
): Promise<void> {
  if (!isSmbLaunchNavEnabled()) return;
  if (!(await isTrialOrganization(organizationId))) return;
  redirect(`/settings/subscription?upgrade=${encodeURIComponent(feature)}`);
}
