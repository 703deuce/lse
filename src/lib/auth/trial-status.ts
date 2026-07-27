import { isSmbLaunchNavEnabled } from "@/lib/product/smb-launch";

/**
 * Client-safe trial check from org billing fields (no DB imports).
 * Keep in sync with `isTrialOrganization` in `trial.ts`.
 */
export function organizationLooksLikeTrial(input: {
  plan?: string | null;
  billing_status?: string | null;
}): boolean {
  const billing = String(input.billing_status ?? "manual").toLowerCase();
  const plan = String(input.plan ?? "starter").toLowerCase();

  if (billing === "trialing") return true;
  if (billing === "active") return false;

  // Default SMB signup path
  if (isSmbLaunchNavEnabled() && plan === "starter" && (billing === "manual" || billing === "ok")) {
    return true;
  }
  return false;
}
