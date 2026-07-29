import { NextResponse } from "next/server";
import { getPaymentPageBySlug, recordQrEvent } from "@/lib/reputation/payment-qr/service";
import { QR_EVENT_TYPES } from "@/lib/reputation/payment-qr/types";
import type { PaymentProvider } from "@/lib/reputation/payment-qr/types";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { httpErrorFromException } from "@/lib/security/http-errors";

export async function POST(request: Request) {
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await assertRateLimit({
      key: `payment-qr-event:${ip}`,
      maxPerWindow: 120,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = (await request.json()) as {
      slug?: string;
      eventType?: string;
      provider?: string;
      amountSelectedCents?: number;
      sessionId?: string;
      paymentRequestSessionId?: string;
      metadata?: Record<string, unknown>;
      isPreview?: boolean;
    };

    if (!body.slug || !body.eventType) {
      return NextResponse.json({ error: "slug and eventType required" }, { status: 400 });
    }
    if (!QR_EVENT_TYPES.includes(body.eventType as never)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }

    const page = await getPaymentPageBySlug(body.slug);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const userAgent = request.headers.get("user-agent") ?? undefined;
    const referrer = request.headers.get("referer") ?? undefined;

    const result = await recordQrEvent({
      campaignId: page.campaign.id,
      organizationId: page.campaign.organizationId,
      businessId: page.campaign.businessId,
      eventType: body.eventType as never,
      provider: body.provider as PaymentProvider | undefined,
      amountSelectedCents: body.amountSelectedCents,
      sessionId: body.sessionId,
      paymentRequestSessionId: body.paymentRequestSessionId,
      metadata: body.metadata,
      userAgent,
      referrer,
      ip,
      isPreview: body.isPreview,
    });

    return NextResponse.json({ recorded: result.recorded });
  } catch (err) {
    return httpErrorFromException(err, "Failed to record event");
  }
}
