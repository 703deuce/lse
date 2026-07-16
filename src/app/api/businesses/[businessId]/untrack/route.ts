import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
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

    return NextResponse.json({ ok: true, businessId, isTracked: false });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Untrack failed";
    const status =
      message.includes("access denied") || message.includes("not found") ? 403 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
