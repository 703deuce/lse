import { NextResponse } from "next/server";
import { createAnonymousQrProject, buildQrTrackedUrl } from "@/lib/reputation/qr-campaigns";
import { buildGoogleReviewUrl } from "@/lib/reputation/review-requests";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { trackProductEvent } from "@/lib/analytics/product-events";

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await assertRateLimit({
      key: `public-qr-create:${ip}`,
      maxPerWindow: 8,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many QR codes generated from this network. Try again later." },
        { status: 429 }
      );
    }

    const body = (await request.json()) as {
      businessName?: string;
      placeId?: string;
      destinationUrl?: string;
      headline?: string;
      description?: string;
      brandColor?: string;
      printFormat?: "a4" | "a5" | "letter";
    };

    const businessName = (body.businessName ?? "").trim();
    if (!businessName) {
      return NextResponse.json({ error: "Business name is required." }, { status: 400 });
    }

    let destinationUrl = (body.destinationUrl ?? "").trim();
    const placeId = (body.placeId ?? "").trim();
    if (!destinationUrl && placeId) {
      destinationUrl = buildGoogleReviewUrl(placeId);
    }
    if (!destinationUrl) {
      return NextResponse.json(
        { error: "Provide a Google Place ID or a Google review destination URL." },
        { status: 400 }
      );
    }

    const campaign = await createAnonymousQrProject({
      businessName,
      destinationUrl,
      headline: body.headline,
      description: body.description,
      brandColor: body.brandColor,
      printFormat: body.printFormat,
    });

    trackProductEvent("qr_generated", {
      campaignId: campaign.id,
      source: "public",
    });

    return NextResponse.json({
      campaign: {
        id: campaign.id,
        name: campaign.name,
        shortCode: campaign.shortCode,
        trackedUrl: buildQrTrackedUrl(campaign.shortCode),
        destinationUrl: campaign.destinationUrl,
        headline: campaign.headline,
        description: campaign.description,
        brandColor: campaign.brandColor,
        printFormat: campaign.printFormat,
        showFooter: campaign.showFooter,
        posterConfig: campaign.posterConfig,
      },
      claimToken: campaign.claimToken,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to create QR project");
  }
}
