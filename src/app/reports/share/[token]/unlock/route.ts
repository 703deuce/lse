import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createServiceClient } from "@/lib/db/client";
import { hashShareToken } from "@/lib/reporting/share-token";
import {
  SHARE_UNLOCK_COOKIE_MAX_AGE_SEC,
  shareUnlockCookieName,
  verifySharePassword,
} from "@/lib/reporting/share-password";
import { mergeCookieOptions } from "@/lib/supabase/cookie-options";

export async function POST(
  request: NextRequest,
  context: { params: Promise<{ token: string }> }
) {
  const { token } = await context.params;
  if (!token || token.length < 16 || token.length > 128) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  const form = await request.formData();
  const password = String(form.get("password") ?? "");
  if (!password) {
    return NextResponse.redirect(new URL(`/reports/share/${token}?error=1`, request.url));
  }

  const supabase = createServiceClient();
  const tokenHash = hashShareToken(token);

  let { data: report } = await supabase
    .from("reports")
    .select("id, share_password_hash, share_token_hash")
    .eq("share_token_hash", tokenHash)
    .maybeSingle();

  if (!report) {
    const legacy = await supabase
      .from("reports")
      .select("id, share_password_hash, share_token_hash")
      .eq("share_token", token)
      .is("share_token_hash", null)
      .maybeSingle();
    report = legacy.data;
  }

  if (!report?.share_password_hash) {
    return NextResponse.redirect(new URL(`/reports/share/${token}`, request.url));
  }

  const ok = await verifySharePassword(password, String(report.share_password_hash));
  if (!ok) {
    return NextResponse.redirect(new URL(`/reports/share/${token}?error=1`, request.url));
  }

  const hashForCookie = String(report.share_token_hash ?? tokenHash);
  const cookieName = shareUnlockCookieName(hashForCookie);
  const cookieStore = await cookies();
  cookieStore.set(
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

  return NextResponse.redirect(new URL(`/reports/share/${token}`, request.url));
}
