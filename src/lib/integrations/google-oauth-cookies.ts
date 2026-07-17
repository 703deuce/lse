import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { mergeCookieOptions } from "@/lib/supabase/cookie-options";

export const GOOGLE_OAUTH_STATE_COOKIE = "google_oauth_state";
export const GOOGLE_OAUTH_VERIFIER_COOKIE = "google_oauth_pkce_verifier";

const OAUTH_COOKIE_PATH = "/api/integrations/google";
const OAUTH_COOKIE_MAX_AGE_SEC = 600;

export function generateOAuthState(): string {
  return randomBytes(32).toString("base64url");
}

export function generatePkceVerifier(): string {
  return randomBytes(32).toString("base64url");
}

export async function setGoogleOAuthCookies(state: string, codeVerifier: string): Promise<void> {
  const cookieStore = await cookies();
  const base = mergeCookieOptions({
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: OAUTH_COOKIE_PATH,
    maxAge: OAUTH_COOKIE_MAX_AGE_SEC,
  });
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, state, base);
  cookieStore.set(GOOGLE_OAUTH_VERIFIER_COOKIE, codeVerifier, base);
}

export async function consumeGoogleOAuthState(expectedState: string | null): Promise<{
  ok: boolean;
  codeVerifier: string | null;
}> {
  const cookieStore = await cookies();
  const storedState = cookieStore.get(GOOGLE_OAUTH_STATE_COOKIE)?.value ?? null;
  const codeVerifier = cookieStore.get(GOOGLE_OAUTH_VERIFIER_COOKIE)?.value ?? null;
  cookieStore.set(GOOGLE_OAUTH_STATE_COOKIE, "", mergeCookieOptions({ path: OAUTH_COOKIE_PATH, maxAge: 0 }));
  cookieStore.set(
    GOOGLE_OAUTH_VERIFIER_COOKIE,
    "",
    mergeCookieOptions({ path: OAUTH_COOKIE_PATH, maxAge: 0 })
  );
  if (!expectedState || !storedState || expectedState !== storedState) {
    return { ok: false, codeVerifier: null };
  }
  return { ok: true, codeVerifier };
}
