import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

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
      .maybeSingle();

    if (existing) {
      await supabase
        .from("scheduled_scans")
        .update({ enabled, next_run_at: enabled ? new Date(Date.now() + 7 * 86400000).toISOString() : null })
        .eq("id", existing.id);
    } else {
      await supabase.from("scheduled_scans").insert({
        business_id: businessId,
        enabled,
        next_run_at: enabled ? new Date(Date.now() + 7 * 86400000).toISOString() : null,
      });
    }

    return NextResponse.json({ enabled });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Schedule failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
