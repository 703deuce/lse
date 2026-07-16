import { createServiceClient } from "@/lib/db/client";

export type PlanId = "starter" | "pro" | "agency" | "internal";

export type PlanLimits = {
  max_businesses: number;
  map_credits_month: number;
  bulk_review_requests_month: number;
  sms_month: number;
  email_review_requests_month: number;
  local_trust_scans_month: number;
  backlink_gap_runs_month: number;
  growth_audits_month: number;
  ai_visibility_runs_month: number;
  users_seats: number;
  /** Active Automatic Review Trigger endpoints (non-revoked). */
  webhook_endpoints: number;
  /** Incoming webhook events accepted per billing month. */
  webhook_events_month: number;
};

export type PlanFeatures = {
  rank_grid: boolean;
  review_requests: boolean;
  bulk_review_requests: boolean;
  /** Paid Review Campaigns add-on (multi-channel + sequences). Enforced server-side. */
  review_campaigns: boolean;
  review_campaigns_managed: boolean;
  dedicated_messaging_number: boolean;
  local_trust: boolean;
  backlink_gap: boolean;
  growth_audit: boolean;
  review_momentum: boolean;
  ai_visibility: boolean;
  maps_keyword_difficulty_internal_only: boolean;
};

export type PlanDefinition = {
  id: PlanId;
  name: string;
  priceLabel: string;
  limits: PlanLimits;
  features: PlanFeatures;
};

export const PLAN_DEFINITIONS: Record<PlanId, PlanDefinition> = {
  starter: {
    id: "starter",
    name: "Starter",
    priceLabel: "$29/mo",
    limits: {
      max_businesses: 1,
      map_credits_month: 5000,
      bulk_review_requests_month: 250,
      sms_month: 0,
      email_review_requests_month: 250,
      local_trust_scans_month: 2,
      backlink_gap_runs_month: 2,
      growth_audits_month: 5,
      ai_visibility_runs_month: 5,
      users_seats: 1,
      webhook_endpoints: 0,
      webhook_events_month: 0,
    },
    features: {
      rank_grid: true,
      review_requests: true,
      bulk_review_requests: true,
      // Starter keeps Quick Send; bulk campaigns require the add-on / higher plan.
      review_campaigns: false,
      review_campaigns_managed: false,
      dedicated_messaging_number: false,
      local_trust: true,
      backlink_gap: true,
      growth_audit: true,
      review_momentum: true,
      ai_visibility: true,
      maps_keyword_difficulty_internal_only: false,
    },
  },
  pro: {
    id: "pro",
    name: "Pro",
    priceLabel: "$79/mo",
    limits: {
      max_businesses: 1,
      map_credits_month: 15000,
      bulk_review_requests_month: 1000,
      sms_month: 100,
      email_review_requests_month: 1000,
      local_trust_scans_month: 5,
      backlink_gap_runs_month: 5,
      growth_audits_month: 20,
      ai_visibility_runs_month: 5,
      users_seats: 3,
      webhook_endpoints: 5,
      webhook_events_month: 5000,
    },
    features: {
      rank_grid: true,
      review_requests: true,
      bulk_review_requests: true,
      review_campaigns: true,
      review_campaigns_managed: false,
      dedicated_messaging_number: false,
      local_trust: true,
      backlink_gap: true,
      growth_audit: true,
      review_momentum: true,
      ai_visibility: true,
      maps_keyword_difficulty_internal_only: false,
    },
  },
  agency: {
    id: "agency",
    name: "Agency",
    priceLabel: "$199/mo",
    limits: {
      max_businesses: 10,
      map_credits_month: 50000,
      bulk_review_requests_month: 5000,
      sms_month: 500,
      email_review_requests_month: 5000,
      local_trust_scans_month: 20,
      backlink_gap_runs_month: 20,
      growth_audits_month: 100,
      ai_visibility_runs_month: 25,
      users_seats: 10,
      webhook_endpoints: 25,
      webhook_events_month: 50000,
    },
    features: {
      rank_grid: true,
      review_requests: true,
      bulk_review_requests: true,
      review_campaigns: true,
      review_campaigns_managed: true,
      dedicated_messaging_number: true,
      local_trust: true,
      backlink_gap: true,
      growth_audit: true,
      review_momentum: true,
      ai_visibility: true,
      maps_keyword_difficulty_internal_only: false,
    },
  },
  internal: {
    id: "internal",
    name: "Internal",
    priceLabel: "Admin",
    limits: {
      max_businesses: 9999,
      map_credits_month: 999999,
      bulk_review_requests_month: 999999,
      sms_month: 999999,
      email_review_requests_month: 999999,
      local_trust_scans_month: 999999,
      backlink_gap_runs_month: 999999,
      growth_audits_month: 999999,
      ai_visibility_runs_month: 999999,
      users_seats: 999,
      webhook_endpoints: 9999,
      webhook_events_month: 999999,
    },
    features: {
      rank_grid: true,
      review_requests: true,
      bulk_review_requests: true,
      review_campaigns: true,
      review_campaigns_managed: true,
      dedicated_messaging_number: true,
      local_trust: true,
      backlink_gap: true,
      growth_audit: true,
      review_momentum: true,
      ai_visibility: true,
      maps_keyword_difficulty_internal_only: true,
    },
  },
};

export class PlanLimitError extends Error {
  constructor(
    message: string,
    public readonly limitKey: string
  ) {
    super(message);
    this.name = "PlanLimitError";
  }
}

export type UsageKey =
  | "map_credits_used"
  | "growth_audits_used"
  | "local_trust_scans_used"
  | "backlink_gap_runs_used"
  | "review_emails_sent"
  | "review_sms_sent"
  | "bulk_review_requests_used"
  | "ai_visibility_runs_used";

const USAGE_TO_LIMIT: Record<UsageKey, keyof PlanLimits> = {
  map_credits_used: "map_credits_month",
  growth_audits_used: "growth_audits_month",
  local_trust_scans_used: "local_trust_scans_month",
  backlink_gap_runs_used: "backlink_gap_runs_month",
  review_emails_sent: "email_review_requests_month",
  review_sms_sent: "sms_month",
  bulk_review_requests_used: "bulk_review_requests_month",
  ai_visibility_runs_used: "ai_visibility_runs_month",
};

export type UsageSnapshot = {
  periodStart: string;
  periodEnd: string;
  map_credits_used: number;
  growth_audits_used: number;
  local_trust_scans_used: number;
  backlink_gap_runs_used: number;
  review_emails_sent: number;
  review_sms_sent: number;
  bulk_review_requests_used: number;
  ai_visibility_runs_used: number;
};

function normalizePlanId(planId: string | null | undefined): PlanId {
  if (planId && planId in PLAN_DEFINITIONS) return planId as PlanId;
  return "starter";
}

export function getPlan(planId: string | null | undefined): PlanDefinition {
  return PLAN_DEFINITIONS[normalizePlanId(planId)];
}

export function getCurrentPeriod(): { periodStart: string; periodEnd: string } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  return { periodStart: fmt(start), periodEnd: fmt(end) };
}

export async function getOrganizationPlan(organizationId: string): Promise<PlanDefinition> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("organizations")
    .select("plan")
    .eq("id", organizationId)
    .maybeSingle();
  return getPlan(data?.plan);
}

export async function getCurrentUsage(organizationId: string): Promise<UsageSnapshot> {
  const supabase = createServiceClient();
  const { periodStart, periodEnd } = getCurrentPeriod();

  const { data } = await supabase
    .from("organization_usage_monthly")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("period_start", periodStart)
    .maybeSingle();

  return {
    periodStart,
    periodEnd,
    map_credits_used: data?.map_credits_used ?? 0,
    growth_audits_used: data?.growth_audits_used ?? 0,
    local_trust_scans_used: data?.local_trust_scans_used ?? 0,
    backlink_gap_runs_used: data?.backlink_gap_runs_used ?? 0,
    review_emails_sent: data?.review_emails_sent ?? 0,
    review_sms_sent: data?.review_sms_sent ?? 0,
    bulk_review_requests_used: data?.bulk_review_requests_used ?? 0,
    ai_visibility_runs_used: data?.ai_visibility_runs_used ?? 0,
  };
}

export async function hasFeature(
  organizationId: string,
  featureName: keyof PlanFeatures
): Promise<boolean> {
  const plan = await getOrganizationPlan(organizationId);
  return Boolean(plan.features[featureName]);
}

export async function assertWithinLimit(
  organizationId: string,
  limitKey: keyof PlanLimits,
  amount = 1
): Promise<void> {
  const plan = await getOrganizationPlan(organizationId);
  const limit = plan.limits[limitKey];
  const usage = await getCurrentUsage(organizationId);

  const usageMap: Partial<Record<keyof PlanLimits, number>> = {
    max_businesses: await countBusinesses(organizationId),
    map_credits_month: usage.map_credits_used,
    growth_audits_month: usage.growth_audits_used,
    local_trust_scans_month: usage.local_trust_scans_used,
    backlink_gap_runs_month: usage.backlink_gap_runs_used,
    email_review_requests_month: usage.review_emails_sent,
    sms_month: usage.review_sms_sent,
    bulk_review_requests_month: usage.bulk_review_requests_used,
    ai_visibility_runs_month: usage.ai_visibility_runs_used,
    webhook_endpoints: await countWebhookEndpoints(organizationId),
    webhook_events_month: await countWebhookEventsThisMonth(organizationId),
  };

  const used = usageMap[limitKey] ?? 0;
  if (used + amount > limit) {
    throw new PlanLimitError(
      `Plan limit reached for ${limitKey.replace(/_/g, " ")}. Used ${used} of ${limit}. This action needs ${amount} more.`,
      limitKey
    );
  }
}

async function countBusinesses(organizationId: string): Promise<number> {
  const supabase = createServiceClient();
  // Manual/untracked audits do not consume plan business slots.
  const { count } = await supabase
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .eq("is_tracked", true);
  return count ?? 0;
}

async function countWebhookEndpoints(organizationId: string): Promise<number> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("integration_webhook_endpoints")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("revoked_at", null);
  return count ?? 0;
}

async function countWebhookEventsThisMonth(organizationId: string): Promise<number> {
  const supabase = createServiceClient();
  const { periodStart } = getCurrentPeriod();
  const { count } = await supabase
    .from("integration_webhook_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .gte("received_at", `${periodStart}T00:00:00.000Z`);
  return count ?? 0;
}

export async function incrementUsage(
  organizationId: string,
  usageKey: UsageKey,
  amount = 1
): Promise<void> {
  await reserveUsage(organizationId, usageKey, amount, { enforceLimit: false });
}

/**
 * Atomically add usage. When enforceLimit is true (default for reserveUsageOrThrow),
 * the SQL UPDATE fails closed if the plan cap would be exceeded.
 */
export async function reserveUsage(
  organizationId: string,
  usageKey: UsageKey,
  amount = 1,
  options?: { enforceLimit?: boolean; limitOverride?: number }
): Promise<number> {
  const supabase = createServiceClient();
  const { periodStart, periodEnd } = getCurrentPeriod();
  const enforceLimit = options?.enforceLimit !== false;

  let limit: number | null = null;
  if (enforceLimit) {
    if (typeof options?.limitOverride === "number") {
      limit = options.limitOverride;
    } else {
      const plan = await getOrganizationPlan(organizationId);
      const limitKey = USAGE_TO_LIMIT[usageKey];
      limit = plan.limits[limitKey];
    }
  }

  const { data, error } = await supabase.rpc("increment_org_usage", {
    p_organization_id: organizationId,
    p_period_start: periodStart,
    p_period_end: periodEnd,
    p_usage_key: usageKey,
    p_amount: amount,
    p_limit: enforceLimit ? limit : null,
  });

  if (error) {
    throw new Error(error.message);
  }

  const usedAfter = typeof data === "number" ? data : Number(data);
  if (!Number.isFinite(usedAfter) || usedAfter < 0) {
    throw new PlanLimitError(
      `Plan limit reached for ${usageKey.replace(/_/g, " ")}. This action needs ${amount} more.`,
      USAGE_TO_LIMIT[usageKey]
    );
  }
  return usedAfter;
}

/** Assert plan room and increment in one atomic RPC (preferred over assert+increment). */
export async function reserveUsageOrThrow(
  organizationId: string,
  usageKey: UsageKey,
  amount = 1
): Promise<number> {
  return reserveUsage(organizationId, usageKey, amount, { enforceLimit: true });
}

/**
 * Best-effort refund after a failed action that already reserved usage.
 * The increment RPC only accepts p_amount >= 1, so we decrement directly.
 */
export async function releaseUsage(
  organizationId: string,
  usageKey: UsageKey,
  amount = 1
): Promise<void> {
  if (amount < 1) return;
  const supabase = createServiceClient();
  const { periodStart } = getCurrentPeriod();
  const col = usageKey;
  const allowed: UsageKey[] = [
    "map_credits_used",
    "growth_audits_used",
    "local_trust_scans_used",
    "backlink_gap_runs_used",
    "review_emails_sent",
    "review_sms_sent",
    "bulk_review_requests_used",
    "ai_visibility_runs_used",
  ];
  if (!allowed.includes(col)) return;

  const { data } = await supabase
    .from("organization_usage_monthly")
    .select(col)
    .eq("organization_id", organizationId)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (!data) return;
  const current = Number((data as Record<string, unknown>)[col] ?? 0);
  const next = Math.max(0, current - amount);
  await supabase
    .from("organization_usage_monthly")
    .update({ [col]: next, updated_at: new Date().toISOString() })
    .eq("organization_id", organizationId)
    .eq("period_start", periodStart);
}

export async function resetOrganizationUsage(organizationId: string): Promise<void> {
  const supabase = createServiceClient();
  const { periodStart } = getCurrentPeriod();
  await supabase
    .from("organization_usage_monthly")
    .delete()
    .eq("organization_id", organizationId)
    .eq("period_start", periodStart);
}

export async function setOrganizationPlan(
  organizationId: string,
  planId: PlanId
): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("organizations")
    .update({ plan: planId, updated_at: new Date().toISOString() })
    .eq("id", organizationId);
  if (error) throw new Error(error.message);
}

export function gridMapCredits(gridSize: number, excludedCount = 0): number {
  const total = gridSize * gridSize;
  return Math.max(1, total - Math.max(0, excludedCount));
}
