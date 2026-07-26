import { NextResponse } from "next/server";
import { recordTrackingClick } from "@/lib/reputation/campaigns";
import { resolveAndRecordQrScan } from "@/lib/reputation/qr-campaigns";
import { sanitizeReviewRedirectUrl } from "@/lib/security/safe-redirect";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ trackingToken: string }> }
) {
  const { trackingToken } = await params;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rate = await assertRateLimit({
    key: `track:${ip}`,
    maxPerWindow: 120,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const userAgent = request.headers.get("user-agent") ?? undefined;
  const referrer = request.headers.get("referer") ?? undefined;
  const visitorId =
    request.headers.get("x-visitor-id") ??
    request.headers.get("cookie")?.match(/qr_vid=([^;]+)/)?.[1];

  // 1) Existing SMS/email campaign message tokens
  const messageReviewUrl = await recordTrackingClick({
    token: trackingToken,
    ip,
    userAgent,
  });
  const messageSafe = sanitizeReviewRedirectUrl(messageReviewUrl);
  if (messageSafe) {
    return NextResponse.redirect(messageSafe, 302);
  }

  // 2) QR campaign short codes (/r/{shortCode})
  const qr = await resolveAndRecordQrScan({
    shortCode: trackingToken,
    ip,
    userAgent,
    referrer,
    visitorId: visitorId ?? undefined,
  });

  if (qr.destinationUrl) {
    // QR campaigns open the mobile review funnel first (mockup flow), then Google.
    const landing = new URL(`/go/${encodeURIComponent(trackingToken)}`, request.url);
    return NextResponse.redirect(landing, 302);
  }

  const fallback = new URL("/r/unavailable", request.url);
  if (qr.inactive) fallback.searchParams.set("reason", "paused");
  else if (qr.notFound) fallback.searchParams.set("reason", "missing");
  else fallback.searchParams.set("reason", "invalid");
  return NextResponse.redirect(fallback, 302);
}
