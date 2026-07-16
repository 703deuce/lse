import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { USABLE_SCAN_STATUSES } from "@/lib/scans/status";

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("scheduled_scans")
      .select("id, enabled, next_run_at, cron_expression, grid_size, radius_meters")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      enabled: Boolean(data?.enabled),
      nextRunAt: data?.next_run_at ?? null,
      cronExpression: data?.cron_expression ?? null,
      gridSize: data?.grid_size ?? null,
      radiusMeters: data?.radius_meters ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Schedule fetch failed";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, enabled = true } = body as {
      businessId?: string;
      enabled?: boolean;
      gridSize?: number;
      radiusMeters?: number;
    };
    if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    // Prefer latest usable scan grid/radius so weekly jobs match the user's baseline.
    const { data: latestScan } = await supabase
      .from("scan_batches")
      .select("grid_size, radius_meters")
      .eq("business_id", businessId)
      .in("status", [...USABLE_SCAN_STATUSES])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const gridSize =
      typeof body.gridSize === "number"
        ? body.gridSize
        : (latestScan?.grid_size ?? 7);
    const radiusMeters =
      typeof body.radiusMeters === "number"
        ? body.radiusMeters
        : (latestScan?.radius_meters ?? 8047);

    const { data: existing } = await supabase
      .from("scheduled_scans")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existing) {
      const { error } = await supabase
        .from("scheduled_scans")
        .update({
          enabled,
          grid_size: gridSize,
          radius_meters: radiusMeters,
          next_run_at: enabled ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
        })
        .eq("id", existing.id)
        .eq("business_id", businessId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase.from("scheduled_scans").insert({
        business_id: businessId,
        enabled,
        grid_size: gridSize,
        radius_meters: radiusMeters,
        next_run_at: enabled ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ enabled, gridSize, radiusMeters });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Schedule failed";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
