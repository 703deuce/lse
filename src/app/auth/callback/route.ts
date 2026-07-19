import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureUserOrganization } from "@/lib/auth/onboarding";
import { getAppBaseUrl } from "@/lib/app-url";
import { isSoftHomePath, resolvePostLoginPath } from "@/lib/auth/home-path";

function safeNextPath(raw: string | null): string | null {
  if (!raw) return null;
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) {
    return null;
  }
  return raw;
}

function trustedRedirectBase(request: Request, origin: string): string {
  const configured = getAppBaseUrl();
  try {
    const configuredHost = new URL(configured).host.toLowerCase();
    const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim().toLowerCase();
    if (forwardedHost && forwardedHost === configuredHost) {
      return configured;
    }
  } catch {
    /* fall through */
  }
  // Never trust arbitrary X-Forwarded-Host — use APP_URL in production, origin in local.
  if (process.env.NODE_ENV === "production") {
    return configured;
  }
  return origin;
}

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);

  const code = searchParams.get("code");
  const requestedNext = safeNextPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      let next = requestedNext && !isSoftHomePath(requestedNext) ? requestedNext : null;

      if (user) {
        const organizationId = await ensureUserOrganization(user);
        if (!next) {
          next = await resolvePostLoginPath(organizationId);
        }
      }

      const base = trustedRedirectBase(request, origin);
      return NextResponse.redirect(`${base}${next ?? "/workspace"}`);
    }
  }

  return NextResponse.redirect(`${origin}/sign-in?error=auth_callback_failed`);
}
