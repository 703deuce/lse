import type { CookieOptions } from "@supabase/ssr";

/**
 * Defaults for Supabase auth session cookies.
 * Must NOT set httpOnly — @supabase/ssr browser clients read the session
 * via document.cookie. Use explicit httpOnly on non-auth cookies (CSRF,
 * share unlock, OAuth state) when those helpers call mergeCookieOptions.
 */
export function supabaseCookieOptions(): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
  };
}

export function mergeCookieOptions(
  options?: CookieOptions | null
): CookieOptions {
  return { ...supabaseCookieOptions(), ...(options ?? {}) };
}
