import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

export async function GET(request: Request) {
  try {
    const businessId = new URL(request.url).searchParams.get("businessId");
    if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();
    const { data } = await supabase
      .from("scheduled_scans")
      .select("id, enabled, next_run_at, cron_expression")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    return NextResponse.json({
      enabled: Boolean(data?.enabled),
      nextRunAt: data?.next_run_at ?? null,
      cronExpression: data?.cron_expression ?? null,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Schedule fetch failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, enabled = true } = body as { businessId?: string; enabled?: boolean };
    if (!businessId) return NextResponse.json({ error: "businessId required" }, { status: 400 });

    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

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
          next_run_at: enabled ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
        })
        .eq("id", existing.id);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    } else {
      const { error } = await supabase.from("scheduled_scans").insert({
        business_id: businessId,
        enabled,
        next_run_at: enabled ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
      });
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ enabled });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Schedule failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
