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

    const { count: businessCount } = await supabase
      .from("businesses")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", auth.organizationId);

    return NextResponse.json({
      organization: org,
      plan,
      usage,
      businessCount: businessCount ?? 0,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load account usage";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
