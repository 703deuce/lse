import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireAuth } from "@/lib/auth/context";
import { createServiceClient } from "@/lib/db/client";
import { getOrganizationPlan } from "@/lib/plans";

/** List locations for the signed-in org (switcher + businesses hub). */
export async function GET() {
  try {
    const auth = await requireAuth();
    const supabase = createServiceClient();
    const plan = await getOrganizationPlan(auth.organizationId);

    // city/state live on business_keywords, not businesses — selecting them
    // breaks the locations hub with "column businesses.city does not exist".
    const { data, error } = await supabase
      .from("businesses")
      .select(
        "id, name, address_text, scan_center_label, primary_category, is_tracked, account_type, prospect_status, primary_contact_name, primary_contact_email, notes, archived_at, created_at"
      )
      .eq("organization_id", auth.organizationId)
      .order("name", { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const businesses = data ?? [];
    const trackedCount = businesses.filter(
      (b) => b.is_tracked !== false && !b.archived_at
    ).length;

    return NextResponse.json({
      businesses,
      trackedCount,
      maxBusinesses: plan.limits.max_businesses,
      planId: plan.id,
      planName: plan.name,
      canAdd: trackedCount < plan.limits.max_businesses,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to list businesses");
  }
}
