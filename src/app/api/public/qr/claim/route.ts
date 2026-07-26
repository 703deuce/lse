import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { claimAnonymousQrProject, buildQrTrackedUrl } from "@/lib/reputation/qr-campaigns";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { trackProductEvent } from "@/lib/analytics/product-events";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await assertRateLimit({
      key: `public-qr-claim:${auth.userId}:${ip}`,
      maxPerWindow: 20,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "Too many claim attempts." }, { status: 429 });
    }

    const body = (await request.json()) as {
      claimToken?: string;
      businessId?: string;
    };
    if (!body.claimToken?.trim() || !body.businessId?.trim()) {
      return NextResponse.json(
        { error: "claimToken and businessId are required." },
        { status: 400 }
      );
    }

    const campaign = await claimAnonymousQrProject({
      claimToken: body.claimToken.trim(),
      organizationId: auth.organizationId,
      businessId: body.businessId.trim(),
      ownerUserId: auth.userId,
    });

    trackProductEvent("qr_anonymous_claimed", {
      organizationId: auth.organizationId,
      businessId: body.businessId,
      campaignId: campaign.id,
    });

    return NextResponse.json({
      campaign,
      trackedUrl: buildQrTrackedUrl(campaign.shortCode),
      nextHref: `/businesses/${body.businessId}/reputation/qr-campaigns/${campaign.id}`,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to claim QR project");
  }
}
