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
};

export type PlanFeatures = {
  rank_grid: boolean;
  review_requests: boolean;
  bulk_review_requests: boolean;
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
    },
    features: {
      rank_grid: true,
      review_requests: true,
      bulk_review_requests: true,
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
    },
    features: {
      rank_grid: true,
      review_requests: true,
      bulk_review_requests: true,
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
    },
    features: {
      rank_grid: true,
      review_requests: true,
      bulk_review_requests: true,
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
    },
    features: {
      rank_grid: true,
      review_requests: true,
      bulk_review_requests: true,
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
  const { count } = await supabase
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId);
  return count ?? 0;
}

export async function incrementUsage(
  organizationId: string,
  usageKey: UsageKey,
  amount = 1
): Promise<void> {
  const supabase = createServiceClient();
  const { periodStart, periodEnd } = getCurrentPeriod();

  const { data: existing, error: fetchError } = await supabase
    .from("organization_usage_monthly")
    .select("id, map_credits_used, growth_audits_used, local_trust_scans_used, backlink_gap_runs_used, review_emails_sent, review_sms_sent, bulk_review_requests_used, ai_visibility_runs_used")
    .eq("organization_id", organizationId)
    .eq("period_start", periodStart)
    .maybeSingle();

  if (fetchError) {
    throw new Error(fetchError.message);
  }

  if (existing && "id" in existing) {
    const current = (existing as Record<UsageKey, number>)[usageKey] ?? 0;
    await supabase
      .from("organization_usage_monthly")
      .update({
        [usageKey]: current + amount,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id as string);
    return;
  }

  await supabase.from("organization_usage_monthly").insert({
    organization_id: organizationId,
    period_start: periodStart,
    period_end: periodEnd,
    [usageKey]: amount,
  });
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

export function gridMapCredits(gridSize: number): number {
  return gridSize * gridSize;
}
