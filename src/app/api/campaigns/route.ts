import { NextResponse } from "next/server";
import { z } from "zod";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/db/client";
import { trackProductEvent } from "@/lib/analytics/product-events";
import { getOrganizationPlan } from "@/lib/plans";
import {
  assertGridSizeAllowed,
  assertScheduleAllowed,
  resolveFreelancerLimits,
} from "@/lib/plans/resolve-freelancer-limits";

const createSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  defaultGridSize: z.number().int().min(3).max(13).optional(),
  defaultRadiusMeters: z.number().int().min(100).max(50000).optional(),
  scheduleType: z.enum(["manual", "weekly", "biweekly", "monthly"]).optional(),
  scheduleDay: z.number().int().min(0).max(31).nullable().optional(),
  scheduleTimezone: z.string().max(80).nullable().optional(),
  scheduleEnabled: z.boolean().optional(),
});

export async function GET(request: Request) {
  try {
    const auth = await requireAuth();
    const { searchParams } = new URL(request.url);
    const businessId = searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    await requireBusinessAccess(businessId);

    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("maps_campaigns")
      .select("*")
      .eq("business_id", businessId)
      .is("archived_at", null)
      .order("created_at", { ascending: true });

    if (error) {
      // Table may not exist until migration 071 is applied.
      if (/maps_campaigns|does not exist/i.test(error.message)) {
        return NextResponse.json({ campaigns: [], migrationPending: true });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      campaigns: data ?? [],
      organizationId: auth.organizationId,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to list campaigns");
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
    const p = parsed.data;
    const auth = await requireBusinessAccess(p.businessId);
    await requireOrganizationPermission("business.update", auth.organizationId);
    const plan = await getOrganizationPlan(auth.organizationId);
    const limits = resolveFreelancerLimits(plan.id);
    const gridSize = p.defaultGridSize ?? 7;
    const gridOk = assertGridSizeAllowed(gridSize, limits);
    if (!gridOk.ok) {
      return NextResponse.json({ error: gridOk.message }, { status: 400 });
    }
    const scheduleType = p.scheduleType ?? "manual";
    const scheduleEnabled = p.scheduleEnabled ?? false;
    if (scheduleEnabled || scheduleType !== "manual") {
      const schedOk = assertScheduleAllowed(scheduleType, limits);
      if (!schedOk.ok) {
        return NextResponse.json({ error: schedOk.message }, { status: 403 });
      }
    }
    const supabase = createServiceClient();

    let nextScheduledAt: string | null = null;
    if (scheduleEnabled && scheduleType !== "manual") {
      const days =
        scheduleType === "monthly" ? 30 : scheduleType === "biweekly" ? 14 : 7;
      nextScheduledAt = new Date(Date.now() + days * 86400000).toISOString();
    }

    const { data, error } = await supabase
      .from("maps_campaigns")
      .insert({
        business_id: p.businessId,
        name: p.name.trim(),
        description: p.description ?? null,
        default_grid_size: gridSize,
        default_radius_meters: p.defaultRadiusMeters ?? 3000,
        schedule_type: scheduleType,
        schedule_day: p.scheduleDay ?? null,
        schedule_timezone: p.scheduleTimezone ?? null,
        schedule_enabled: scheduleEnabled,
        next_scheduled_at: nextScheduledAt,
      })
      .select("*")
      .single();

    if (error || !data) {
      return NextResponse.json(
        { error: error?.message ?? "Create failed" },
        { status: 500 }
      );
    }

    trackProductEvent("campaign_created", {
      organizationId: auth.organizationId,
      businessId: p.businessId,
      campaignId: data.id,
    });

    return NextResponse.json({ campaign: data });
  } catch (err) {
    return httpErrorFromException(err, "Failed to create campaign");
  }
}
