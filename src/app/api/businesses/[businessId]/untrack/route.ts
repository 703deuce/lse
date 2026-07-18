import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/db/client";

/**
 * Mark a business as untracked (manual audit). Disables scheduled Maps runs.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const auth = await requireBusinessAccess(businessId);
    await requireOrganizationPermission("business.update", auth.organizationId);
    const supabase = createServiceClient();

    const { data: business } = await supabase
      .from("businesses")
      .select("id")
      .eq("id", businessId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("businesses")
      .update({
        is_tracked: false,
        archived_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    await supabase
      .from("scheduled_scans")
      .update({ enabled: false, next_run_at: null })
      .eq("business_id", businessId);

    // Also stop Maps keyword campaign schedules (071+).
    await supabase
      .from("maps_campaigns")
      .update({
        schedule_enabled: false,
        updated_at: new Date().toISOString(),
      })
      .eq("business_id", businessId)
      .is("archived_at", null);

    return NextResponse.json({
      ok: true,
      businessId,
      isTracked: false,
      archived: true,
    });
  } catch (err) {
    return httpErrorFromException(err, "Untrack failed");
  }
}
