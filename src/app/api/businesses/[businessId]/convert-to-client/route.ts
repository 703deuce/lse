import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { requireOrganizationPermission } from "@/lib/auth/permissions";
import { createServiceClient } from "@/lib/db/client";
import { assertWithinLimit, PlanLimitError } from "@/lib/plans";
import { trackProductEvent } from "@/lib/analytics/product-events";

/**
 * Convert prospect → client without duplicating locations, scans, or reports.
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
      .select("id, organization_id, is_tracked, account_type, archived_at")
      .eq("id", businessId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const alreadyClient =
      business.account_type === "client" && business.is_tracked !== false && !business.archived_at;

    if (alreadyClient) {
      return NextResponse.json({
        ok: true,
        alreadyClient: true,
        businessId,
      });
    }

    if (business.is_tracked === false || business.archived_at) {
      await assertWithinLimit(auth.organizationId, "max_businesses", 1);
    }

    const { error } = await supabase
      .from("businesses")
      .update({
        account_type: "client",
        prospect_status: "won",
        is_tracked: true,
        tracking_source: "convert",
        archived_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", businessId)
      .eq("organization_id", auth.organizationId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Ensure a default Maps campaign exists for keyword grouping.
    const { data: existingCampaign } = await supabase
      .from("maps_campaigns")
      .select("id")
      .eq("business_id", businessId)
      .is("archived_at", null)
      .limit(1)
      .maybeSingle();

    if (!existingCampaign) {
      const { data: created } = await supabase
        .from("maps_campaigns")
        .insert({
          business_id: businessId,
          name: "Primary keywords",
          description: "Created on prospect → client conversion",
        })
        .select("id")
        .maybeSingle();

      if (created?.id) {
        await supabase
          .from("business_keywords")
          .update({ campaign_id: created.id })
          .eq("business_id", businessId)
          .is("campaign_id", null);
      }
    }

    trackProductEvent("prospect_converted", {
      organizationId: auth.organizationId,
      businessId,
    });

    return NextResponse.json({
      ok: true,
      alreadyClient: false,
      businessId,
      accountType: "client",
    });
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    return httpErrorFromException(err, "Convert failed");
  }
}
