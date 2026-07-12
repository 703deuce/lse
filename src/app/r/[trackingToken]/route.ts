import { NextResponse } from "next/server";
import { recordTrackingClick } from "@/lib/reputation/campaigns";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ trackingToken: string }> }
) {
  const { trackingToken } = await params;
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    undefined;
  const userAgent = request.headers.get("user-agent") ?? undefined;

  const reviewUrl = await recordTrackingClick({ token: trackingToken, ip, userAgent });

  if (!reviewUrl) {
    return NextResponse.redirect(new URL("/", request.url), 302);
  }

  return NextResponse.redirect(reviewUrl, 302);
}
