import { createServiceClient } from "@/lib/db/client";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";

export type LifecyclePhase =
  | "needs_onboarding"
  | "reputation_ready"
  | "maps_activated";

export type BusinessLifecycleState = {
  businessId: string;
  businessName: string;
  phase: LifecyclePhase;
  hasReviewsData: boolean;
  hasMapsScan: boolean;
  latestScanId: string | null;
  placeId: string | null;
  /** Explicit wizard finish (migration 079 column). */
  setupCompletedAt: string | null;
  /**
   * True when the wizard was finished OR the business already has review data
   * (grandfathered accounts that never ran the new wizard).
   */
  setupCompleted: boolean;
};

/** Org has at least one non-archived business. */
export async function orgHasBusinesses(organizationId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("archived_at", null);
  return (count ?? 0) > 0;
}

/** Primary (newest tracked) business for post-login landing. */
export async function loadPrimaryBusinessId(organizationId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("businesses")
    .select("id")
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.id ? String(data.id) : null;
}

export async function businessHasUsableMapsScan(businessId: string): Promise<{
  hasMapsScan: boolean;
  latestScanId: string | null;
}> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("scan_batches")
    .select("id, status, aggregate_metrics")
    .eq("business_id", businessId)
    .in("status", [...USABLE_SCAN_STATUSES])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data?.id) return { hasMapsScan: false, latestScanId: null };
  return {
    hasMapsScan: true,
    latestScanId: String(data.id),
  };
}

export async function businessHasReviewsData(businessId: string): Promise<boolean> {
  const supabase = createServiceClient();
  const { count } = await supabase
    .from("business_reviews")
    .select("id", { count: "exact", head: true })
    .eq("business_id", businessId)
    .eq("is_deleted", false);
  return (count ?? 0) > 0;
}

export async function markReputationSetupCompleted(businessId: string): Promise<void> {
  const supabase = createServiceClient();
  const { error } = await supabase
    .from("businesses")
    .update({ reputation_setup_completed_at: new Date().toISOString() })
    .eq("id", businessId)
    .is("reputation_setup_completed_at", null);
  // Column may not exist until migration 079 is applied — ignore quietly.
  if (error && !/reputation_setup_completed_at/i.test(error.message)) {
    throw error;
  }
}

export async function loadBusinessLifecycleState(
  businessId: string
): Promise<BusinessLifecycleState | null> {
  const supabase = createServiceClient();
  let business: {
    id: string;
    name: string | null;
    place_id: string | null;
    reputation_setup_completed_at?: string | null;
  } | null = null;

  const withSetup = await supabase
    .from("businesses")
    .select("id, name, place_id, reputation_setup_completed_at")
    .eq("id", businessId)
    .maybeSingle();

  if (withSetup.error && /reputation_setup_completed_at/i.test(withSetup.error.message)) {
    const fallback = await supabase
      .from("businesses")
      .select("id, name, place_id")
      .eq("id", businessId)
      .maybeSingle();
    business = fallback.data;
  } else {
    business = withSetup.data;
  }
  if (!business) return null;

  const [{ hasMapsScan, latestScanId }, hasReviewsData] = await Promise.all([
    businessHasUsableMapsScan(businessId),
    businessHasReviewsData(businessId),
  ]);

  const setupCompletedAt =
    business.reputation_setup_completed_at != null
      ? String(business.reputation_setup_completed_at)
      : null;

  // Explicit finish, or grandfathered account that already imported reviews/maps.
  const setupCompleted = setupCompletedAt != null || hasReviewsData || hasMapsScan;

  const phase: LifecyclePhase = hasMapsScan
    ? "maps_activated"
    : setupCompleted
      ? "reputation_ready"
      : "needs_onboarding";

  return {
    businessId,
    businessName: String(business.name ?? "Business"),
    phase,
    hasReviewsData,
    hasMapsScan,
    latestScanId,
    placeId: business.place_id != null ? String(business.place_id) : null,
    setupCompletedAt,
    setupCompleted,
  };
}

/** Post-login / soft-home destination for an organization. */
export async function resolveLifecycleHomePath(organizationId: string): Promise<string> {
  if (!organizationId) return "/onboarding";
  const hasBiz = await orgHasBusinesses(organizationId);
  if (!hasBiz) return "/onboarding";

  const businessId = await loadPrimaryBusinessId(organizationId);
  if (!businessId) return "/onboarding";

  const state = await loadBusinessLifecycleState(businessId);
  if (!state || state.phase === "needs_onboarding") {
    return `/onboarding?businessId=${businessId}`;
  }
  // Returning users land on Reputation Overview — never a checklist.
  return `/businesses/${businessId}/reputation/overview`;
}
