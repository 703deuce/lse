import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { assertWithinLimit, PlanLimitError } from "@/lib/plans";

/**
 * Convert a manual/untracked business into a tracked slot (consumes max_businesses).
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
      .select("id, organization_id, is_tracked, tracking_source")
      .eq("id", businessId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    if (business.is_tracked !== false) {
      return NextResponse.json({
        ok: true,
        alreadyTracked: true,
        businessId,
        isTracked: true,
        trackingSource: business.tracking_source ?? "manual",
      });
    }

    await assertWithinLimit(auth.organizationId, "max_businesses", 1);

    const { error } = await supabase
      .from("businesses")
      .update({
        is_tracked: true,
        tracking_source: "convert",
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId)
      .eq("organization_id", auth.organizationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      alreadyTracked: false,
      businessId,
      isTracked: true,
      trackingSource: "convert",
    });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    return httpErrorFromException(err, "Convert failed");
  }
}
