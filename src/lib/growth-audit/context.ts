import { createServiceClient } from "@/lib/db/client";
import { loadGbpProfile, loadCompetitorsForBusiness } from "@/lib/audit/run-audit";
import { crawlSitePages } from "@/lib/audit/website-crawler";
import { parseUsAddressCityState } from "@/lib/geo/us-address";
import { loadServiceAreas } from "@/lib/growth-audit/local-areas";
import { loadBacklinkGapSummaryForAudit } from "@/lib/growth-audit/backlink-summary";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";
import type { GbpProfile, LoadedCompetitor, ParsedPage } from "@/lib/audit/types";
import type { BacklinkGapSummary } from "@/lib/growth-audit/backlink-summary";
import type { ServiceArea } from "@/lib/growth-audit/local-areas";

export type GrowthAuditContext = {
  businessId: string;
  organizationId: string;
  keyword: string;
  gbp: GbpProfile;
  competitors: LoadedCompetitor[];
  competitorCategories: string[];
  pages: ParsedPage[];
  scanBatchId: string | null;
  scanMetrics: Record<string, number | null> | null;
  scanAuditScores: {
    relevance: number;
    distance: number;
    prominence: number;
    trust: number;
    overall: number;
  } | null;
  serviceAreas: ServiceArea[];
  backlinkGap: BacklinkGapSummary | null;
};

export async function loadGrowthAuditContext(
  businessId: string,
  organizationId: string,
  keyword?: string
): Promise<GrowthAuditContext> {
  const supabase = createServiceClient();
  const gbp = await loadGbpProfile(businessId);
  if (!gbp) throw new Error("Business not found");

  const { data: keywords } = await supabase
    .from("business_keywords")
    .select("keyword, is_primary, city, state")
    .eq("business_id", businessId);
  const primary = keywords?.find((k) => k.is_primary) ?? keywords?.[0];

  if (!gbp.city || !gbp.state) {
    const { data: biz } = await supabase.from("businesses").select("address_text").eq("id", businessId).single();
    const parsed = parseUsAddressCityState(biz?.address_text);
    gbp.city = gbp.city ?? parsed.city;
    gbp.state = gbp.state ?? parsed.state;
  }

  const competitors = await loadCompetitorsForBusiness(businessId);
  const competitorCategories = competitors.flatMap((c) =>
    [c.category, ...(c.additionalCategories ?? [])].filter(Boolean) as string[]
  );

  const [serviceAreas, backlinkGap] = await Promise.all([
    loadServiceAreas(businessId, gbp),
    loadBacklinkGapSummaryForAudit(businessId),
  ]);

  let pages: ParsedPage[] = [];
  if (gbp.website) {
    try {
      pages = await crawlSitePages(gbp.website, 20);
    } catch {
      pages = [];
    }
  }

  const { data: latestScan } = await supabase
    .from("scan_batches")
    .select("id, aggregate_metrics, status")
    .eq("business_id", businessId)
    .in("status", [...USABLE_SCAN_STATUSES, "enriching"])
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let scanAuditScores: GrowthAuditContext["scanAuditScores"] = null;
  if (latestScan?.id) {
    const { data: audit } = await supabase
      .from("audits")
      .select("relevance_score, distance_score, prominence_score, trust_score, overall_score")
      .eq("scan_batch_id", latestScan.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (audit) {
      scanAuditScores = {
        relevance: audit.relevance_score ?? 0,
        distance: audit.distance_score ?? 0,
        prominence: audit.prominence_score ?? 0,
        trust: audit.trust_score ?? 0,
        overall: audit.overall_score ?? 0,
      };
    }
  }

  return {
    businessId,
    organizationId,
    keyword: keyword ?? primary?.keyword ?? gbp.name,
    gbp,
    competitors,
    competitorCategories,
    pages,
    scanBatchId: latestScan?.id ?? null,
    scanMetrics: (latestScan?.aggregate_metrics as Record<string, number | null>) ?? null,
    scanAuditScores,
    serviceAreas,
    backlinkGap,
  };
}
