import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { updateCampaignStatus, type CampaignStatus } from "@/lib/reputation/campaigns";

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
    const message = err instanceof Error ? err.message : "Failed to update campaign";
    const statusCode = message.includes("not found") ? 404 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
