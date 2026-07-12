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

    await requireBusinessAccess(businessId);

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

    const campaign = await updateCampaignStatus(campaignId, businessId, status);
    return NextResponse.json({ campaign });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update campaign";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
