import { NextResponse } from "next/server";
import { getPaymentPageBySlug, recordQrEvent, resolveProviderDestination } from "@/lib/reputation/payment-qr/service";
import { PROVIDER_CLICK_EVENTS, PAYMENT_PROVIDERS } from "@/lib/reputation/payment-qr/types";
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
      key: `payment-open:${ip}`,
      maxPerWindow: 60,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const body = (await request.json()) as {
      slug?: string;
      provider?: string;
      amountCents?: number;
      note?: string | null;
      sessionId?: string;
      isPreview?: boolean;
    };

    if (!body.slug || !body.provider) {
      return NextResponse.json({ error: "slug and provider required" }, { status: 400 });
    }
    if (!PAYMENT_PROVIDERS.includes(body.provider as PaymentProvider)) {
      return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
    }

    const page = await getPaymentPageBySlug(body.slug);
    if (!page) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    const userAgent = request.headers.get("user-agent") ?? undefined;
    const referrer = request.headers.get("referer") ?? undefined;

    const resolved = await resolveProviderDestination({
      slug: body.slug,
      provider: body.provider as PaymentProvider,
      amountCents: body.amountCents,
      note: body.note,
    });

    const clickEvent =
      PROVIDER_CLICK_EVENTS[body.provider as PaymentProvider] ?? "payment_method_clicked";

    await recordQrEvent({
      campaignId: page.campaign.id,
      organizationId: page.campaign.organizationId,
      businessId: page.campaign.businessId,
      eventType: clickEvent,
      provider: body.provider as PaymentProvider,
      amountSelectedCents: resolved.amountCents,
      sessionId: body.sessionId,
      paymentRequestSessionId: page.requestSession?.id,
      userAgent,
      referrer,
      ip,
      isPreview: body.isPreview,
    });

    return NextResponse.json(resolved);
  } catch (err) {
    return httpErrorFromException(err, "Failed to open payment provider");
  }
}
