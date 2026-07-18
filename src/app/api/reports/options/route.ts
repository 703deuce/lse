import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { listCampaigns } from "@/lib/reputation/campaigns";

/** Lightweight pickers for the Reports hub (no campaign entitlement required). */
export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    const [{ data: keywords }, campaigns, { data: schedule }, mapsCampaignsRes] =
      await Promise.all([
        supabase
          .from("business_keywords")
          .select("id, keyword, is_primary")
          .eq("business_id", businessId)
          .order("is_primary", { ascending: false })
          .order("created_at", { ascending: true }),
        listCampaigns(businessId).catch(() => []),
        supabase
          .from("scheduled_scans")
          .select("enabled, next_run_at, grid_size, radius_meters")
          .eq("business_id", businessId)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("maps_campaigns")
          .select(
            "id, name, schedule_enabled, schedule_type, next_scheduled_at, default_grid_size, default_radius_meters"
          )
          .eq("business_id", businessId)
          .is("archived_at", null)
          .order("updated_at", { ascending: false })
          .limit(50),
      ]);

    const mapsCampaigns = /maps_campaigns|does not exist/i.test(
      mapsCampaignsRes.error?.message ?? ""
    )
      ? []
      : (mapsCampaignsRes.data ?? []);

    return NextResponse.json({
      keywords: (keywords ?? []).map((k) => ({
        id: k.id as string,
        keyword: String(k.keyword),
        isPrimary: Boolean(k.is_primary),
      })),
      campaigns: (campaigns ?? []).map((c) => ({
        id: c.id as string,
        name: String(c.name ?? "Campaign"),
        status: String(c.status ?? "draft"),
        channel: String(c.channel ?? "sms"),
        sent: Number(c.sent ?? 0),
        reviewsDetected: Number(c.reviews_detected ?? 0),
      })),
      mapsCampaigns: mapsCampaigns.map((c) => ({
        id: c.id as string,
        name: String(c.name ?? "Maps campaign"),
        status: String(c.schedule_type ?? "manual"),
        scheduleEnabled: Boolean(c.schedule_enabled),
        nextRunAt: (c.next_scheduled_at as string | null) ?? null,
        gridSize: (c.default_grid_size as number | null) ?? null,
        radiusMeters: (c.default_radius_meters as number | null) ?? null,
      })),
      schedule: {
        enabled: Boolean(schedule?.enabled),
        nextRunAt: (schedule?.next_run_at as string | null) ?? null,
        gridSize: (schedule?.grid_size as number | null) ?? null,
        radiusMeters: (schedule?.radius_meters as number | null) ?? null,
      },
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load report options");
  }
}
