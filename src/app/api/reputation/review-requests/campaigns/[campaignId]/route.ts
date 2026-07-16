import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import {
  getCampaignDetail,
  getRecipientEventHistory,
  updateCampaignStatus,
  type CampaignStatus,
} from "@/lib/reputation/campaigns";
import { createServiceClient } from "@/lib/db/client";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ campaignId: string }> }
) {
  try {
    const { campaignId } = await params;
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");

    const recipientId = url.searchParams.get("recipientId");
    if (recipientId) {
      const history = await getRecipientEventHistory({
        campaignId,
        businessId,
        recipientId,
      });
      return NextResponse.json(history);
    }

    const detail = await getCampaignDetail(campaignId, businessId, {
      recipientCursor: url.searchParams.get("cursor"),
      recipientLimit: Number(url.searchParams.get("limit") ?? 50),
      recipientStatus: url.searchParams.get("recipientStatus"),
    });
    return NextResponse.json(detail);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to load campaign";
    const statusCode = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}

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
      const campaign = await updateCampaignStatus(
        campaignId,
        businessId,
        "archived",
        auth.organizationId
      );
      const supabase = createServiceClient();
      await supabase
        .from("review_request_campaigns")
        .update({ archived_at: new Date().toISOString() })
        .eq("id", campaignId)
        .eq("business_id", businessId);
      return NextResponse.json({ campaign: { ...campaign, archived_at: new Date().toISOString() } });
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

    const supabase = createServiceClient();
    const { data: before } = await supabase
      .from("review_request_campaigns")
      .select("status")
      .eq("id", campaignId)
      .eq("business_id", businessId)
      .eq("organization_id", auth.organizationId)
      .maybeSingle();
    if (!before) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }

    // Draft → active/scheduled launch: reserve bulk quota that was skipped on draft save.
    let reservedReady = 0;
    if (status === "active" && before.status === "draft") {
      const { data: readyRecs } = await supabase
        .from("review_request_recipients")
        .select("id")
        .eq("campaign_id", campaignId)
        .eq("business_id", businessId)
        .eq("status", "ready");
      reservedReady = readyRecs?.length ?? 0;
      if (reservedReady > 0) {
        await reserveUsageOrThrow(auth.organizationId, "bulk_review_requests_used", reservedReady);
      }
    }

    try {
      const campaign = await updateCampaignStatus(
        campaignId,
        businessId,
        status,
        auth.organizationId
      );
      return NextResponse.json({ campaign });
    } catch (updateErr) {
      if (reservedReady > 0) {
        await releaseUsage(auth.organizationId, "bulk_review_requests_used", reservedReady).catch(
          () => undefined
        );
      }
      throw updateErr;
    }
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Failed to update campaign";
    const statusCode = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
