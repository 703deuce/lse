import { NextResponse } from "next/server";
import { z } from "zod";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/db/client";
import { getOrganizationPlan } from "@/lib/plans";
import {
  assertGridSizeAllowed,
  assertScheduleAllowed,
  resolveFreelancerLimits,
} from "@/lib/plans/resolve-freelancer-limits";
import { loadCampaignKeywordMetrics } from "@/lib/campaigns/keyword-metrics";

const patchSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(2000).nullable().optional(),
  defaultGridSize: z.number().int().min(3).max(13).optional(),
  defaultRadiusMeters: z.number().int().min(100).max(50000).optional(),
  scheduleType: z.enum(["manual", "weekly", "biweekly", "monthly"]).optional(),
  scheduleDay: z.number().int().min(0).max(31).nullable().optional(),
  scheduleTimezone: z.string().max(80).nullable().optional(),
  scheduleEnabled: z.boolean().optional(),
  nextScheduledAt: z.string().datetime().nullable().optional(),
  baselineScanBatchId: z.string().uuid().nullable().optional(),
  archive: z.boolean().optional(),
});

async function loadCampaign(campaignId: string) {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("maps_campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const campaign = await loadCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    await requireBusinessAccess(campaign.business_id);

    const supabase = createServiceClient();
    const keywords = await loadCampaignKeywordMetrics(supabase, {
      businessId: campaign.business_id as string,
      campaignId,
      gridSize: Number(campaign.default_grid_size ?? 7),
      radiusMeters: Number(campaign.default_radius_meters ?? 3000),
    });

    const { data: business } = await supabase
      .from("businesses")
      .select("id, name, account_type")
      .eq("id", campaign.business_id)
      .maybeSingle();

    return NextResponse.json({
      campaign,
      keywords,
      business,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load campaign");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const campaign = await loadCampaign(campaignId);
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    const access = await requireBusinessAccess(campaign.business_id);
    await requireOrganizationPermission("business.update", access.organizationId);
    const plan = await getOrganizationPlan(access.organizationId);
    const limits = resolveFreelancerLimits(plan.id);

    const parsed = patchSchema.safeParse(await request.json());
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const p = parsed.data;
    if (p.defaultGridSize != null) {
      const gridOk = assertGridSizeAllowed(p.defaultGridSize, limits);
      if (!gridOk.ok) {
        return NextResponse.json({ error: gridOk.message }, { status: 400 });
      }
    }
    const nextScheduleType = p.scheduleType ?? String(campaign.schedule_type ?? "manual");
    const enabling =
      p.scheduleEnabled === true ||
      (p.scheduleType != null && p.scheduleType !== "manual");
    if (enabling || (p.scheduleType != null && p.scheduleType !== "manual")) {
      const schedOk = assertScheduleAllowed(nextScheduleType, limits);
      if (!schedOk.ok) {
        return NextResponse.json({ error: schedOk.message }, { status: 403 });
      }
    }

    if (p.baselineScanBatchId) {
      const supabaseCheck = createServiceClient();
      const { data: batch } = await supabaseCheck
        .from("scan_batches")
        .select("id, business_id")
        .eq("id", p.baselineScanBatchId)
        .maybeSingle();
      if (!batch || batch.business_id !== campaign.business_id) {
        return NextResponse.json(
          { error: "Baseline scan must belong to this client" },
          { status: 400 }
        );
      }
    }

    const patch: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (p.name !== undefined) patch.name = p.name.trim();
    if (p.description !== undefined) patch.description = p.description;
    if (p.defaultGridSize !== undefined) patch.default_grid_size = p.defaultGridSize;
    if (p.defaultRadiusMeters !== undefined) {
      patch.default_radius_meters = p.defaultRadiusMeters;
    }
    if (p.scheduleType !== undefined) patch.schedule_type = p.scheduleType;
    if (p.scheduleDay !== undefined) patch.schedule_day = p.scheduleDay;
    if (p.scheduleTimezone !== undefined) patch.schedule_timezone = p.scheduleTimezone;
    if (p.scheduleEnabled !== undefined) {
      patch.schedule_enabled = p.scheduleEnabled;
      if (p.scheduleEnabled && p.nextScheduledAt === undefined) {
        const type = p.scheduleType ?? campaign.schedule_type ?? "weekly";
        const days = type === "monthly" ? 30 : type === "biweekly" ? 14 : 7;
        patch.next_scheduled_at = new Date(Date.now() + days * 86400000).toISOString();
      }
      if (p.scheduleEnabled === false && p.nextScheduledAt === undefined) {
        patch.next_scheduled_at = null;
      }
    }
    if (p.nextScheduledAt !== undefined) patch.next_scheduled_at = p.nextScheduledAt;
    if (p.baselineScanBatchId !== undefined) {
      patch.baseline_scan_batch_id = p.baselineScanBatchId;
    }
    if (p.archive === true) {
      patch.archived_at = new Date().toISOString();
      patch.schedule_enabled = false;
      patch.next_scheduled_at = null;
    }

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("maps_campaigns")
      .update(patch)
      .eq("id", campaignId)
      .select("*")
      .maybeSingle();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ campaign: data });
  } catch (err) {
    return httpErrorFromException(err, "Failed to update campaign");
  }
}
