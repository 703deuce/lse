/**
 * Create and enqueue Maps scans for due maps_campaigns schedules.
 * Complements legacy scheduled_scans SQL discovery.
 */

import { createServiceClient } from "@/lib/db/client";
import { enqueueMapsScanJob } from "@/lib/queue/service";
import { assertCanEnqueueMapsScan } from "@/lib/queue/fairness";
import { logger } from "@/lib/observability/logger";
import { trackProductEvent } from "@/lib/analytics/product-events";
import {
  getOrganizationPlan,
  gridMapCredits,
  PlanLimitError,
  releaseUsage,
  reserveUsageOrThrow,
} from "@/lib/plans";
import {
  assertGridSizeAllowed,
  assertScheduleAllowed,
  resolveFreelancerLimits,
} from "@/lib/plans/resolve-freelancer-limits";

function advanceNextRun(scheduleType: string, from: Date): Date {
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
  const now = new Date();
  const nowIso = now.toISOString();

  const { data: campaigns, error } = await supabase
    .from("maps_campaigns")
    .select(
      "id, business_id, name, default_grid_size, default_radius_meters, schedule_type, schedule_enabled, next_scheduled_at"
    )
    .eq("schedule_enabled", true)
    .is("archived_at", null)
    .neq("schedule_type", "manual")
    .lte("next_scheduled_at", nowIso)
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
    const priorNext = campaign.next_scheduled_at as string;
    const nextRun = advanceNextRun(String(campaign.schedule_type), now).toISOString();

    // Atomic claim — only one worker processes this due row.
    const { data: claimed, error: claimErr } = await supabase
      .from("maps_campaigns")
      .update({
        next_scheduled_at: nextRun,
        updated_at: new Date().toISOString(),
      })
      .eq("id", campaign.id)
      .eq("schedule_enabled", true)
      .eq("next_scheduled_at", priorNext)
      .select("id")
      .maybeSingle();

    if (claimErr || !claimed) {
      continue;
    }

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

    const orgId = biz.organization_id as string;
    const plan = await getOrganizationPlan(orgId).catch(() => null);
    const limits = resolveFreelancerLimits(plan?.id);
    const scheduleOk = assertScheduleAllowed(String(campaign.schedule_type), limits);
    if (!scheduleOk.ok) {
      await supabase
        .from("maps_campaigns")
        .update({
          schedule_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
      logger.warn("maps_campaign_schedule_not_allowed", {
        campaignId: campaign.id,
        message: scheduleOk.message,
      });
      continue;
    }

    const gridSize = Number(campaign.default_grid_size ?? 7);
    const gridOk = assertGridSizeAllowed(gridSize, limits);
    if (!gridOk.ok) {
      await supabase
        .from("maps_campaigns")
        .update({
          schedule_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
      logger.warn("maps_campaign_grid_not_allowed", {
        campaignId: campaign.id,
        message: gridOk.message,
      });
      continue;
    }

    const fairness = await assertCanEnqueueMapsScan({
      organizationId: orgId,
      businessId,
      scanBatchId: "00000000-0000-0000-0000-000000000000",
      gridSize,
    });
    // Only the queued-depth cap should block schedule creation. An already-running
    // scan must not prevent queueing the rest — execution is serial per org.
    if (!fairness.ok && fairness.code === "queued_limit") {
      // Put back due so we retry soon instead of skipping a whole period.
      await supabase
        .from("maps_campaigns")
        .update({
          next_scheduled_at: nowIso,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
      logger.warn("maps_campaign_fairness_blocked", {
        campaignId: campaign.id,
        reason: fairness.reason,
      });
      continue;
    }

    const { data: keywords } = await supabase
      .from("business_keywords")
      .select("id, keyword, active")
      .eq("campaign_id", campaign.id)
      .eq("business_id", businessId);

    const activeKeywords = (keywords ?? []).filter((k) => k.active !== false);
    if (!activeKeywords.length) {
      continue;
    }

    const { data: businessGeo } = await supabase
      .from("businesses")
      .select("scan_center_lat, scan_center_lng, scan_center_label, lat, lng")
      .eq("id", businessId)
      .maybeSingle();

    const centerLat = businessGeo?.scan_center_lat ?? businessGeo?.lat;
    const centerLng = businessGeo?.scan_center_lng ?? businessGeo?.lng;
    if (
      centerLat == null ||
      centerLng == null ||
      !Number.isFinite(Number(centerLat)) ||
      !Number.isFinite(Number(centerLng)) ||
      (Number(centerLat) === 0 && Number(centerLng) === 0)
    ) {
      await supabase
        .from("maps_campaigns")
        .update({
          schedule_enabled: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
      logger.warn("maps_campaign_missing_center", { campaignId: campaign.id, businessId });
      continue;
    }

    let enqueued = 0;
    for (const kw of activeKeywords) {
      // Re-check per keyword so a full campaign still queues, but we stop when
      // the org queued/active caps are hit (execution stays serial separately).
      const keywordFairness = await assertCanEnqueueMapsScan({
        organizationId: orgId,
        businessId,
        scanBatchId: "00000000-0000-0000-0000-000000000000",
        gridSize,
      });
      if (!keywordFairness.ok && keywordFairness.code === "queued_limit") {
        logger.warn("maps_campaign_fairness_blocked_mid_loop", {
          campaignId: campaign.id,
          reason: keywordFairness.reason,
        });
        break;
      }

      const creditsNeeded = gridMapCredits(gridSize);
      let reserved = false;
      try {
        await reserveUsageOrThrow(orgId, "map_credits_used", creditsNeeded);
        reserved = true;
      } catch (err) {
        if (err instanceof PlanLimitError) {
          logger.warn("maps_campaign_credit_limit", {
            campaignId: campaign.id,
            keywordId: kw.id,
            message: err.message,
          });
          break;
        }
        throw err;
      }

      const { data: batch, error: batchErr } = await supabase
        .from("scan_batches")
        .insert({
          business_id: businessId,
          status: "queued",
          scan_type: "scheduled",
          grid_size: gridSize,
          radius_meters: campaign.default_radius_meters ?? 3000,
          device: "mobile",
          os: "android",
          center_lat: centerLat,
          center_lng: centerLng,
          center_label: businessGeo?.scan_center_label ?? null,
          confidence_summary: {
            scheduled: true,
            mapsCampaignId: campaign.id,
            keyword_ids: [kw.id],
            keyword_label: kw.keyword,
            keywordId: kw.id,
            keyword: kw.keyword,
          },
        })
        .select("id")
        .maybeSingle();

      if (batchErr || !batch?.id) {
        if (reserved) {
          await releaseUsage(orgId, "map_credits_used", creditsNeeded).catch(() => {});
        }
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
          organizationId: orgId,
          priority: "normal",
        });
        reserved = false;
        enqueued++;
        created++;
        trackProductEvent("scheduled_scan_created", {
          organizationId: orgId,
          businessId,
          campaignId: campaign.id,
          scanId: batch.id,
        });
      } catch (err) {
        if (reserved) {
          await releaseUsage(orgId, "map_credits_used", creditsNeeded).catch(() => {});
        }
        logger.warn("maps_campaign_enqueue_failed", {
          scanBatchId: batch.id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    // If nothing enqueued, retry soon instead of waiting a full period.
    if (enqueued === 0) {
      await supabase
        .from("maps_campaigns")
        .update({
          next_scheduled_at: new Date(Date.now() + 15 * 60_000).toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaign.id);
    }
  }

  return created;
}
