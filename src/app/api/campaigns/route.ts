import { NextResponse } from "next/server";
import { z } from "zod";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { trackProductEvent } from "@/lib/analytics/product-events";

const createSchema = z.object({
  businessId: z.string().uuid(),
  name: z.string().min(1).max(120),
  description: z.string().max(2000).nullable().optional(),
  defaultGridSize: z.number().int().min(3).max(15).optional(),
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
    const supabase = createServiceClient();

    const { data, error } = await supabase
      .from("maps_campaigns")
      .insert({
        business_id: p.businessId,
        name: p.name.trim(),
        description: p.description ?? null,
        default_grid_size: p.defaultGridSize ?? 7,
        default_radius_meters: p.defaultRadiusMeters ?? 3000,
        schedule_type: p.scheduleType ?? "manual",
        schedule_day: p.scheduleDay ?? null,
        schedule_timezone: p.scheduleTimezone ?? null,
        schedule_enabled: p.scheduleEnabled ?? false,
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
