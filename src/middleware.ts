import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getDevDefaultAppPath, isDevBypassEnabled } from "@/lib/auth/dev";
import { REQUEST_ID_HEADER, resolveRequestId } from "@/lib/observability/request-id";
import { isCsrfExemptPath, isSameOriginMutation } from "@/lib/security/csrf";

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
  return (
    pathname.startsWith("/businesses") ||
    pathname.startsWith("/agency") ||
    pathname.startsWith("/tools") ||
    pathname.startsWith("/admin")
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
    if (
      !isCsrfExemptPath(pathname) &&
      !isSameOriginMutation({
        method: request.method,
        url: request.url,
        headers: request.headers,
      })
    ) {
      const denied = NextResponse.json({ error: "Invalid origin" }, { status: 403 });
      denied.headers.set(REQUEST_ID_HEADER, requestId);
      return denied;
    }
    return nextWithRequestId(request, requestId);
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
            response.cookies.set(name, value, options);
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
