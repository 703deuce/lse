import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { getPaymentQrAnalytics } from "@/lib/reputation/payment-qr/service";
import { getQrCampaignForBusiness } from "@/lib/reputation/qr-campaigns";
import { httpErrorFromException } from "@/lib/security/http-errors";

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
    const campaign = await getQrCampaignForBusiness({
      campaignId,
      businessId,
      organizationId: auth.organizationId,
    });
    if (!campaign) {
      return NextResponse.json({ error: "Campaign not found" }, { status: 404 });
    }
    const days = Number(url.searchParams.get("days") ?? 30);
    const analytics = await getPaymentQrAnalytics(campaignId, days);
    return NextResponse.json(analytics);
  } catch (err) {
    return httpErrorFromException(err, "Failed to load payment analytics");
  }
}
