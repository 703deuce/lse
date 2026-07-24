import { getOrganizationPlan, type PlanFeatures } from "@/lib/plans";
import { createServiceClient } from "@/lib/db/client";
import { isDevMockAuthEnabled } from "@/lib/auth/dev";

/** Paid / feature add-ons for Review Campaigns and messaging. */
export type AddonEntitlement =
  | "review_campaigns"
  | "review_campaigns_managed"
  | "dedicated_messaging_number"
  | keyof PlanFeatures;

export class EntitlementError extends Error {
  constructor(
    message: string,
    public readonly entitlement: string
  ) {
    super(message);
    this.name = "EntitlementError";
  }
}

type OrgAddons = Partial<Record<AddonEntitlement, boolean>>;

async function getOrgAddons(organizationId: string): Promise<OrgAddons> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("organizations")
      .select("addons, billing_status")
      .eq("id", organizationId)
      .maybeSingle();
    const addons = (data?.addons ?? {}) as OrgAddons;
    return addons;
  } catch (error) {
    if (isDevMockAuthEnabled()) return {};
    throw error;
  }
}

/** Org-level kill switch for Reputation outbound (campaigns / SMS / email). */
export async function isOutboundPaused(organizationId: string): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("organizations")
      .select("outbound_paused, status")
      .eq("id", organizationId)
      .maybeSingle();
    if (String(data?.status ?? "active") === "suspended") return true;
    return Boolean(data?.outbound_paused);
  } catch (error) {
    if (isDevMockAuthEnabled()) return false;
    throw error;
  }
}

export async function getOrgBillingStatus(
  organizationId: string
): Promise<string> {
  try {
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("organizations")
      .select("billing_status")
      .eq("id", organizationId)
      .maybeSingle();
    return String(data?.billing_status ?? "manual");
  } catch (error) {
    if (isDevMockAuthEnabled()) return "manual";
    throw error;
  }
}

/** Billing statuses that may continue scheduling outbound campaign messages. */
const HEALTHY_BILLING = new Set(["manual", "active", "trialing", "ok"]);

export async function isBillingHealthy(organizationId: string): Promise<boolean> {
  const status = await getOrgBillingStatus(organizationId);
  return HEALTHY_BILLING.has(status);
}

/**
 * Entitlement resolution order:
 * 1. Explicit organization.addons[key] (true/false) wins
 * 2. Else plan.features[key] when the key is a plan feature
 * 3. Else false
 */
export async function hasEntitlement(
  organizationId: string,
  entitlement: AddonEntitlement
): Promise<boolean> {
  if (isDevMockAuthEnabled() && entitlement === "review_campaigns") {
    return true;
  }

  const addons = await getOrgAddons(organizationId);
  if (Object.prototype.hasOwnProperty.call(addons, entitlement)) {
    return Boolean(addons[entitlement]);
  }
  const plan = await getOrganizationPlan(organizationId);
  if (entitlement in plan.features) {
    if (plan.features[entitlement as keyof PlanFeatures]) return true;
  }
  // Grandfather: starter historically had bulk campaigns via bulk_review_requests.
  // Keep those orgs working until add-ons are assigned explicitly.
  if (entitlement === "review_campaigns" && plan.features.bulk_review_requests) {
    return true;
  }
  return false;
}

export async function requireEntitlement(
  organizationId: string,
  entitlement: AddonEntitlement
): Promise<void> {
  const ok = await hasEntitlement(organizationId, entitlement);
  if (!ok) {
    throw new EntitlementError(
      `Add-on required: ${entitlement.replace(/_/g, " ")}. Upgrade to continue.`,
      entitlement
    );
  }
}

/** Outbound campaign sending requires the add-on, healthy billing, and not paused. */
export async function requireCampaignSendAccess(organizationId: string): Promise<void> {
  await requireEntitlement(organizationId, "review_campaigns");
  if (await isOutboundPaused(organizationId)) {
    throw new EntitlementError(
      "Outbound messaging is paused for this organization.",
      "outbound_paused"
    );
  }
  if (!(await isBillingHealthy(organizationId))) {
    throw new EntitlementError(
      "Billing is inactive. Campaign sending is paused until payment is restored.",
      "billing_status"
    );
  }
}
