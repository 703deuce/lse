import type { CookieOptions } from "@supabase/ssr";

/** Secure session cookie defaults for production SaaS. */
export function supabaseCookieOptions(): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
  };
}

export function mergeCookieOptions(
  options?: CookieOptions | null
): CookieOptions {
  return { ...supabaseCookieOptions(), ...(options ?? {}) };
}
