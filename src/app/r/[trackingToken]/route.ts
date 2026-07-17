import { NextResponse } from "next/server";
import { recordTrackingClick } from "@/lib/reputation/campaigns";
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
  const rate = assertRateLimit({
    key: `track:${ip}`,
    maxPerWindow: 120,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const userAgent = request.headers.get("user-agent") ?? undefined;
  const reviewUrl = await recordTrackingClick({ token: trackingToken, ip, userAgent });
  const safe = sanitizeReviewRedirectUrl(reviewUrl);

  if (!safe) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  return NextResponse.redirect(safe, 302);
}
