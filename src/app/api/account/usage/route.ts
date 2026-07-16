import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { getCurrentUsage, getOrganizationPlan } from "@/lib/plans";

export async function GET() {
  try {
    const auth = await requireAuth();
    const supabase = createServiceClient();

    const { data: org } = await supabase
      .from("organizations")
      .select("id, name, plan, billing_status, status")
      .eq("id", auth.organizationId)
      .maybeSingle();

    const plan = await getOrganizationPlan(auth.organizationId);
    const usage = await getCurrentUsage(auth.organizationId);

    const monthStart = `${usage.periodStart}T00:00:00.000Z`;
    let businessCount = 0;
    const tracked = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.organizationId)
      .eq("is_tracked", true);
    if (tracked.error) {
      // Pre-migration fallback when is_tracked column is not applied yet.
      const all = await supabase
        .from("businesses")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", auth.organizationId);
      businessCount = all.count ?? 0;
    } else {
      businessCount = tracked.count ?? 0;
    }

    const [{ count: webhookEndpoints }, { count: webhookEventsMonth }] = await Promise.all([
      supabase
        .from("integration_webhook_endpoints")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", auth.organizationId)
        .is("revoked_at", null),
      supabase
        .from("integration_webhook_events")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", auth.organizationId)
        .gte("received_at", monthStart),
    ]);

    return NextResponse.json({
      organization: org,
      plan,
      usage,
      businessCount,
      webhookEndpoints: webhookEndpoints ?? 0,
      webhookEventsMonth: webhookEventsMonth ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load account usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
