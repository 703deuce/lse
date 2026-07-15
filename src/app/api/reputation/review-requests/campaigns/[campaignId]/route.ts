import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import { updateCampaignStatus, type CampaignStatus } from "@/lib/reputation/campaigns";
import { createServiceClient } from "@/lib/db/client";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const body = await request.json();
    const { businessId, action } = body as { businessId?: string; action?: string };

    if (!businessId || !action) {
      return NextResponse.json({ error: "businessId and action required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    if (action === "archive") {
      const supabase = createServiceClient();
      const { data, error } = await supabase
        .from("review_request_campaigns")
        .update({
          status: "archived",
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", campaignId)
        .eq("business_id", businessId)
        .eq("organization_id", auth.organizationId)
        .select("*")
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
      return NextResponse.json({ campaign: data });
    }

    const statusMap: Record<string, CampaignStatus> = {
      pause: "paused",
      resume: "active",
      cancel: "cancelled",
      start: "active",
    };
    const status = statusMap[action];
    if (!status) {
      return NextResponse.json({ error: "Invalid action" }, { status: 400 });
    }

    const campaign = await updateCampaignStatus(
      campaignId,
      businessId,
      status,
      auth.organizationId
    );
    return NextResponse.json({ campaign });
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to update campaign";
    const statusCode = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
