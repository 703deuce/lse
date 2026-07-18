import { createServiceClient } from "@/lib/db/client";
import { buildLocationReport } from "@/lib/reporting/build-location";
import { resolveOrgWhiteLabel } from "@/lib/reporting/white-label";
import type {
  MapsCampaignReportPayload,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

/**
 * Maps Campaign report = keyword-group progress for a maps_campaigns row
 * (falls back to scheduled_scans when no campaignId is provided).
 */
export async function buildMapsCampaignReport(params: {
  businessId: string;
  campaignId?: string | null;
  whiteLabel?: Partial<WhiteLabelConfig>;
}): Promise<MapsCampaignReportPayload> {
  const supabase = createServiceClient();

  const location = await buildLocationReport({
    businessId: params.businessId,
    whiteLabel: params.whiteLabel,
  });

  let campaign: {
    id: string;
    name: string;
    schedule_enabled: boolean | null;
    schedule_type: string | null;
    next_scheduled_at: string | null;
    default_grid_size: number | null;
    default_radius_meters: number | null;
  } | null = null;

  if (params.campaignId) {
    const { data } = await supabase
      .from("maps_campaigns")
      .select(
        "id, name, schedule_enabled, schedule_type, next_scheduled_at, default_grid_size, default_radius_meters"
      )
      .eq("id", params.campaignId)
      .eq("business_id", params.businessId)
      .maybeSingle();
    campaign = data;
  }

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, organization_id, address_text")
    .eq("id", params.businessId)
    .single();
  if (!business) throw new Error("Business not found");

  const whiteLabel = await resolveOrgWhiteLabel(
    supabase,
    business,
    params.whiteLabel
  );

  if (!campaign) {
    const { data: schedule } = await supabase
      .from("scheduled_scans")
      .select(
        "enabled, next_run_at, last_run_at, cron_expression, grid_size, radius_meters"
      )
      .eq("business_id", params.businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return {
      reportType: "maps_campaign",
      business: {
        id: business.id,
        name: business.name,
        address: business.address_text ?? null,
      },
      parameters: {
        campaignId: null,
        campaignName: null,
        scheduleEnabled: Boolean(schedule?.enabled),
        cronExpression: (schedule?.cron_expression as string | null) ?? null,
        nextRunAt: (schedule?.next_run_at as string | null) ?? null,
        lastRunAt: (schedule?.last_run_at as string | null) ?? null,
        gridSize: (schedule?.grid_size as number | null) ?? null,
        radiusMeters: (schedule?.radius_meters as number | null) ?? null,
        keywordCount: location.parameters.keywordCount,
        dateFrom: location.parameters.dateFrom,
        dateTo: location.parameters.dateTo,
      },
      aggregate: location.aggregate,
      keywords: location.keywords,
      rising: location.rising,
      falling: location.falling,
      whiteLabel,
      generatedAt: new Date().toISOString(),
    };
  }

  const { data: campaignKeywords } = await supabase
    .from("business_keywords")
    .select("id, keyword")
    .eq("business_id", params.businessId)
    .eq("campaign_id", campaign.id)
    .eq("active", true);

  const keywordFilter = new Set(
    (campaignKeywords ?? []).map((k) => String(k.keyword).trim().toLowerCase())
  );
  const keywords =
    keywordFilter.size > 0
      ? location.keywords.filter((k) =>
          keywordFilter.has(k.keyword.trim().toLowerCase())
        )
      : location.keywords;

  return {
    reportType: "maps_campaign",
    business: {
      id: business.id,
      name: business.name,
      address: business.address_text ?? null,
    },
    parameters: {
      campaignId: campaign.id,
      campaignName: campaign.name,
      scheduleEnabled: Boolean(campaign.schedule_enabled),
      cronExpression: campaign.schedule_type ?? null,
      nextRunAt: campaign.next_scheduled_at ?? null,
      lastRunAt: null,
      gridSize: campaign.default_grid_size ?? null,
      radiusMeters: campaign.default_radius_meters ?? null,
      keywordCount: keywords.length || location.parameters.keywordCount,
      dateFrom: location.parameters.dateFrom,
      dateTo: location.parameters.dateTo,
    },
    aggregate: location.aggregate,
    keywords,
    rising: location.rising.filter((k) =>
      keywordFilter.size ? keywordFilter.has(k.trim().toLowerCase()) : true
    ),
    falling: location.falling.filter((k) =>
      keywordFilter.size ? keywordFilter.has(k.trim().toLowerCase()) : true
    ),
    whiteLabel,
    generatedAt: new Date().toISOString(),
  };
}
