import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getDevDefaultAppPath, isDevBypassEnabled } from "@/lib/auth/dev";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/observability/request-id";
import { evaluateSameOriginMutation, isCsrfExemptPath } from "@/lib/security/csrf";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { logger } from "@/lib/observability/logger";
import { mergeCookieOptions } from "@/lib/supabase/cookie-options";

const PUBLIC_PREFIXES = [
  "/sign-in",
  "/sign-up",
  "/auth/callback",
  "/r/",
  "/reports/share/",
  "/api/webhooks/",
];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
}

function isProtectedPath(pathname: string): boolean {
  // Public share links must stay open (also listed in PUBLIC_PREFIXES).
  if (pathname.startsWith("/reports/share/")) return false;
  return (
    pathname.startsWith("/businesses") ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/prospects") ||
    pathname.startsWith("/clients") ||
    pathname.startsWith("/campaigns") ||
    pathname.startsWith("/scans") ||
    pathname === "/reports" ||
    pathname.startsWith("/reports/") ||
    pathname.startsWith("/ai-visibility") ||
    pathname.startsWith("/locations") ||
    pathname.startsWith("/branding") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/agency") ||
    pathname.startsWith("/tools") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/settings")
  );
}

function nextWithRequestId(request: NextRequest, requestId: string): NextResponse {
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(REQUEST_ID_HEADER, requestId);
  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });
  response.headers.set(REQUEST_ID_HEADER, requestId);
  return response;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const requestId = resolveRequestId(request.headers.get(REQUEST_ID_HEADER));

  // Dev preview routes are never public in production.
  if (pathname.startsWith("/dev/") && process.env.NODE_ENV === "production") {
    const denied = new NextResponse(null, { status: 404 });
    denied.headers.set(REQUEST_ID_HEADER, requestId);
    return denied;
  }

  if (pathname.startsWith("/api/")) {
    // Reject oversized bodies early (ASVS input size control). Imports allow up to ~2MB.
    const contentLength = Number(request.headers.get("content-length") ?? 0);
    const maxBody =
      pathname.startsWith("/api/reputation/contacts/import") ||
      pathname.startsWith("/api/vision/")
        ? 6_000_000
        : 2_000_000;
    if (Number.isFinite(contentLength) && contentLength > maxBody) {
      const denied = NextResponse.json({ error: "Payload too large" }, { status: 413 });
      denied.headers.set(REQUEST_ID_HEADER, requestId);
      return denied;
    }
    if (!isCsrfExemptPath(pathname)) {
      const decision = evaluateSameOriginMutation({
        method: request.method,
        url: request.url,
        headers: request.headers,
      });
      if (!decision.ok) {
        const d = decision.diagnostics;
        logger.warn("csrf_origin_rejected", {
          requestId,
          origin: d.origin,
          refererOrigin: d.refererOrigin,
          expected: d.canonicalOrigin,
          allowedOrigins: d.allowedOrigins,
          requestHost: d.requestHost,
          forwardedHost: d.forwardedHost,
          forwardedProto: d.forwardedProto,
          path: d.path || pathname,
          reason: d.reason,
        });
        const denied = NextResponse.json({ error: "Invalid origin" }, { status: 403 });
        denied.headers.set(REQUEST_ID_HEADER, requestId);
        return denied;
      }
    }
    return nextWithRequestId(request, requestId);
  }

  if (pathname === "/auth/callback" || pathname === "/sign-in") {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await assertRateLimit({
      key: `auth:${pathname}:${ip}`,
      maxPerWindow: 30,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      const denied = new NextResponse("Too many requests", { status: 429 });
      denied.headers.set(REQUEST_ID_HEADER, requestId);
      denied.headers.set("Retry-After", String(Math.ceil(rate.retryAfterMs / 1000)));
      return denied;
    }
  }

  if (isPublicPath(pathname)) {
    return nextWithRequestId(request, requestId);
  }

  const devBypass = isDevBypassEnabled();

  if (devBypass) {
    if (pathname === "/" || pathname === "/sign-in" || pathname === "/sign-up") {
      const target = new URL(getDevDefaultAppPath(), request.url);
      const redirect = NextResponse.redirect(target);
      redirect.headers.set(REQUEST_ID_HEADER, requestId);
      return redirect;
    }
  }

  if (devBypass || !isProtectedPath(pathname)) {
    return nextWithRequestId(request, requestId);
  }

  let response = nextWithRequestId(request, requestId);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: mergeCookieOptions(),
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });
          response = nextWithRequestId(request, requestId);
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, mergeCookieOptions(options));
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && isProtectedPath(pathname)) {
    const signInUrl = new URL("/sign-in", request.url);
    signInUrl.searchParams.set("next", pathname);
    const redirect = NextResponse.redirect(signInUrl);
    redirect.headers.set(REQUEST_ID_HEADER, requestId);
    return redirect;
  }

  if (user && (pathname === "/sign-in" || pathname === "/sign-up")) {
    const redirect = NextResponse.redirect(new URL("/businesses", request.url));
    redirect.headers.set(REQUEST_ID_HEADER, requestId);
    return redirect;
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
