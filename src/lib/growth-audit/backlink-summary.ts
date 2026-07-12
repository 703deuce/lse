import { createServiceClient } from "@/lib/db/client";

export type BacklinkGapSummary = {
  available: boolean;
  yourReferringDomains: number;
  competitorReferringDomains: number;
  missingOpportunities: number;
  highPriorityCount: number;
  status: string;
};

export async function loadBacklinkGapSummaryForAudit(
  businessId: string
): Promise<BacklinkGapSummary | null> {
  const supabase = createServiceClient();
  const { data: run } = await supabase
    .from("backlink_gap_runs")
    .select(
      "target_ref_domain_count, competitor_ref_domain_count, missing_opportunity_count, high_priority_count, status"
    )
    .eq("business_id", businessId)
    .in("status", ["ready", "partial"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!run) return null;

  return {
    available: true,
    yourReferringDomains: Number(run.target_ref_domain_count ?? 0),
    competitorReferringDomains: Number(run.competitor_ref_domain_count ?? 0),
    missingOpportunities: Number(run.missing_opportunity_count ?? 0),
    highPriorityCount: Number(run.high_priority_count ?? 0),
    status: String(run.status ?? "ready"),
  };
}
