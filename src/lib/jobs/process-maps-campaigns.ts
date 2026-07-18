/**
 * Create and enqueue Maps scans for due maps_campaigns schedules.
 * Complements legacy scheduled_scans SQL discovery.
 */

import { createServiceClient } from "@/lib/db/client";
import { enqueueMapsScanJob } from "@/lib/queue/service";
import { logger } from "@/lib/observability/logger";
import { trackProductEvent } from "@/lib/analytics/product-events";

function advanceNextRun(
  scheduleType: string,
  from: Date
): Date {
  const next = new Date(from);
  if (scheduleType === "weekly") {
    next.setDate(next.getDate() + 7);
  } else if (scheduleType === "biweekly") {
    next.setDate(next.getDate() + 14);
  } else if (scheduleType === "monthly") {
    next.setMonth(next.getMonth() + 1);
  } else {
    next.setDate(next.getDate() + 7);
  }
  return next;
}

export async function processDueMapsCampaigns(limit = 10): Promise<number> {
  const supabase = createServiceClient();
  const now = new Date().toISOString();

  const { data: campaigns, error } = await supabase
    .from("maps_campaigns")
    .select(
      "id, business_id, name, default_grid_size, default_radius_meters, schedule_type, schedule_enabled, next_scheduled_at"
    )
    .eq("schedule_enabled", true)
    .is("archived_at", null)
    .neq("schedule_type", "manual")
    .lte("next_scheduled_at", now)
    .order("next_scheduled_at", { ascending: true })
    .limit(Math.min(Math.max(limit, 1), 25));

  if (error) {
    if (/maps_campaigns|does not exist/i.test(error.message)) return 0;
    logger.warn("maps_campaigns_due_query_failed", { error: error.message });
    return 0;
  }
  if (!campaigns?.length) return 0;

  let created = 0;

  for (const campaign of campaigns) {
    const businessId = String(campaign.business_id);
    const { data: biz } = await supabase
      .from("businesses")
      .select("id, organization_id, is_tracked, archived_at, account_type")
      .eq("id", businessId)
      .maybeSingle();

    if (!biz?.organization_id || biz.archived_at || biz.is_tracked === false) {
      await supabase
        .from("maps_campaigns")
        .update({
          schedule_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
      continue;
    }

    const { data: keywords } = await supabase
      .from("business_keywords")
      .select("id, keyword, active")
      .eq("campaign_id", campaign.id)
      .eq("business_id", businessId);

    const activeKeywords = (keywords ?? []).filter((k) => k.active !== false);
    if (!activeKeywords.length) {
      await supabase
        .from("maps_campaigns")
        .update({
          next_scheduled_at: advanceNextRun(
            String(campaign.schedule_type),
            new Date()
          ).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
      continue;
    }

    const { data: businessGeo } = await supabase
      .from("businesses")
      .select("scan_center_lat, scan_center_lng, scan_center_label, lat, lng")
      .eq("id", businessId)
      .maybeSingle();

    const centerLat = businessGeo?.scan_center_lat ?? businessGeo?.lat;
    const centerLng = businessGeo?.scan_center_lng ?? businessGeo?.lng;

    for (const kw of activeKeywords) {
      const { data: batch, error: batchErr } = await supabase
        .from("scan_batches")
        .insert({
          business_id: businessId,
          status: "queued",
          scan_type: "scheduled",
          grid_size: campaign.default_grid_size ?? 7,
          radius_meters: campaign.default_radius_meters ?? 3000,
          device: "mobile",
          os: "android",
          center_lat: centerLat,
          center_lng: centerLng,
          center_label: businessGeo?.scan_center_label ?? null,
          confidence_summary: {
            scheduled: true,
            mapsCampaignId: campaign.id,
            // process-scan filters keywords via keyword_ids (not keywordId).
            keyword_ids: [kw.id],
            keyword_label: kw.keyword,
            keywordId: kw.id,
            keyword: kw.keyword,
          },
        })
        .select("id")
        .maybeSingle();

      if (batchErr || !batch?.id) {
        logger.warn("maps_campaign_batch_create_failed", {
          campaignId: campaign.id,
          keywordId: kw.id,
          error: batchErr?.message,
        });
        continue;
      }

      try {
        await enqueueMapsScanJob({
          scanBatchId: batch.id,
          businessId,
          organizationId: biz.organization_id as string,
          priority: "normal",
        });
        created++;
        trackProductEvent("scheduled_scan_created", {
          organizationId: biz.organization_id as string,
          businessId,
          campaignId: campaign.id,
          scanId: batch.id,
        });
      } catch (err) {
        logger.warn("maps_campaign_enqueue_failed", {
          scanBatchId: batch.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    await supabase
      .from("maps_campaigns")
      .update({
        next_scheduled_at: advanceNextRun(
          String(campaign.schedule_type),
          new Date()
        ).toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id);
  }

  return created;
}
