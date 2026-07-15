import { createServiceClient } from "@/lib/db/client";
import { buildLocationReport } from "@/lib/reporting/build-location";
import { resolveOrgWhiteLabel } from "@/lib/reporting/white-label";
import type {
  MapsCampaignReportPayload,
  WhiteLabelConfig,
} from "@/lib/reporting/types";

/**
 * Maps Campaign report = scheduled tracking summary.
 * Synthesizes schedule metadata + the same keyword rollup as Location Report.
 */
export async function buildMapsCampaignReport(params: {
  businessId: string;
  whiteLabel?: Partial<WhiteLabelConfig>;
}): Promise<MapsCampaignReportPayload> {
  const supabase = createServiceClient();

  const location = await buildLocationReport({
    businessId: params.businessId,
    whiteLabel: params.whiteLabel,
  });

  const { data: schedule } = await supabase
    .from("scheduled_scans")
    .select(
      "enabled, next_run_at, last_run_at, cron_expression, grid_size, radius_meters"
    )
    .eq("business_id", params.businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  // Re-resolve white-label in case location builder already merged it —
  // keep a fresh merge so explicit overrides still win.
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

  return {
    reportType: "maps_campaign",
    business: {
      id: business.id,
      name: business.name,
      address: business.address_text ?? null,
    },
    parameters: {
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
