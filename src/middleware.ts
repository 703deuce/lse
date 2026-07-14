import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getDevDefaultAppPath, isDevBypassEnabled } from "@/lib/auth/dev";

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

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Dev preview routes are never public in production.
  if (pathname.startsWith("/dev/") && process.env.NODE_ENV === "production") {
    return new NextResponse(null, { status: 404 });
  }

  if (isPublicPath(pathname) || pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  const devBypass = isDevBypassEnabled();

  if (devBypass) {
    if (pathname === "/" || pathname === "/sign-in" || pathname === "/sign-up") {
      const target = new URL(getDevDefaultAppPath(), request.url);
      return NextResponse.redirect(target);
    }
  }

  if (devBypass || !isProtectedPath(pathname)) {
    return NextResponse.next();
  }

  let response = NextResponse.next({ request });

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
          response = NextResponse.next({ request });
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
    return NextResponse.redirect(signInUrl);
  }

  if (user && (pathname === "/sign-in" || pathname === "/sign-up")) {
    return NextResponse.redirect(new URL("/businesses", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
