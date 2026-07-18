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
        prospect_status: null,
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

    // Prefer an existing completed scan as campaign baseline after conversion.
    const { data: baselineScan } = await supabase
      .from("scan_batches")
      .select("id")
      .eq("business_id", businessId)
      .in("status", ["ready", "partial", "rank_ready"])
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let campaignId = existingCampaign?.id as string | undefined;
    if (!campaignId) {
      const { data: created } = await supabase
        .from("maps_campaigns")
        .insert({
          business_id: businessId,
          name: "Primary keywords",
          description: "Created on prospect → client conversion",
        })
        .select("id")
        .maybeSingle();

      campaignId = created?.id as string | undefined;
      if (campaignId) {
        await supabase
          .from("business_keywords")
          .update({ campaign_id: campaignId })
          .eq("business_id", businessId)
          .is("campaign_id", null);
      }
    }

    if (campaignId && baselineScan?.id) {
      // Optional until migration 073 is applied — ignore missing-column errors.
      await supabase
        .from("maps_campaigns")
        .update({
          baseline_scan_batch_id: baselineScan.id,
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId)
        .is("baseline_scan_batch_id", null);
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
