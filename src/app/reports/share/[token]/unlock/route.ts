import { NextRequest, NextResponse } from "next/server";
import { appUrl } from "@/lib/app-url";
import { createServiceClient } from "@/lib/db/client";
import { hashShareToken } from "@/lib/reporting/share-token";
import {
  SHARE_UNLOCK_COOKIE_MAX_AGE_SEC,
  shareUnlockCookieName,
  verifySharePassword,
} from "@/lib/reporting/share-password";
import { mergeCookieOptions } from "@/lib/supabase/cookie-options";
import { assertRateLimit } from "@/lib/security/rate-limit";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!token || token.length < 16 || token.length > 128) {
    return NextResponse.redirect(appUrl("/"));
  }

  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";
  const rate = await assertRateLimit({
    key: `share-unlock:${ip}:${token.slice(0, 12)}`,
    maxPerWindow: 10,
    windowMs: 60_000,
  });
  if (!rate.ok) {
    return NextResponse.redirect(appUrl(`/reports/share/${token}?error=1`));
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (!password) {
    return NextResponse.redirect(appUrl(`/reports/share/${token}?error=1`));
  }

  const supabase = createServiceClient();
  const tokenHash = hashShareToken(token);

  let { data: report } = await supabase
    .from("reports")
    .select(
      "id, share_password_hash, share_token_hash, publish_status, share_expires_at"
    )
    .eq("share_token_hash", tokenHash)
    .maybeSingle();

  if (!report) {
    const legacy = await supabase
      .from("reports")
      .select(
        "id, share_password_hash, share_token_hash, publish_status, share_expires_at"
      )
      .eq("share_token", token)
      .is("share_token_hash", null)
      .maybeSingle();
    report = legacy.data;
  }

  if (!report?.share_password_hash) {
    return NextResponse.redirect(appUrl(`/reports/share/${token}`));
  }

  const publishStatus = String(report.publish_status ?? "published");
  if (publishStatus === "draft" || publishStatus === "archived") {
    return NextResponse.redirect(appUrl("/"));
  }
  if (report.share_expires_at) {
    const expires = new Date(report.share_expires_at as string).getTime();
    if (Number.isFinite(expires) && expires <= Date.now()) {
      return NextResponse.redirect(appUrl("/"));
    }
  }

  const ok = await verifySharePassword(password, String(report.share_password_hash));
  if (!ok) {
    return NextResponse.redirect(appUrl(`/reports/share/${token}?error=1`));
  }

  const hashForCookie = String(report.share_token_hash ?? tokenHash);
  const cookieName = shareUnlockCookieName(
    hashForCookie,
    String(report.share_password_hash)
  );
  const response = NextResponse.redirect(appUrl(`/reports/share/${token}`));
  response.cookies.set(
    cookieName,
    "1",
    mergeCookieOptions({
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: `/reports/share/${token}`,
      maxAge: SHARE_UNLOCK_COOKIE_MAX_AGE_SEC,
    })
  );
  return response;
}
