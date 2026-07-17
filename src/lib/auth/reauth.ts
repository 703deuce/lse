import { createClient } from "@/lib/supabase/server";
import { isDevBypassEnabled } from "@/lib/auth/dev";

const DEFAULT_MAX_AGE_MS = Number(process.env.SENSITIVE_REAUTH_MAX_AGE_MS ?? 60 * 60 * 1000);

/** Testable reauth decision from JWT claims (auth_time only; iat-only without AAL2 rejected). */
export function evaluateRecentAuthFromPayload(
  payload: Record<string, unknown> | null,
  maxAgeMs = DEFAULT_MAX_AGE_MS
): { ok: true; authenticatedAt: number } | { ok: false; code: "reauth_required" } {
  if (!payload) {
    return { ok: false, code: "reauth_required" };
  }

  const authTimeSec =
    typeof payload.auth_time === "number" ? payload.auth_time : null;

  if (authTimeSec == null) {
    const aal = typeof payload.aal === "string" ? payload.aal : null;
    if (aal === "aal2") {
      const iat = typeof payload.iat === "number" ? payload.iat : null;
      if (iat != null && Date.now() - iat * 1000 <= maxAgeMs) {
        return { ok: true, authenticatedAt: iat * 1000 };
      }
    }
    return { ok: false, code: "reauth_required" };
  }

  const authenticatedAt = authTimeSec * 1000;
  if (Date.now() - authenticatedAt > maxAgeMs) {
    return { ok: false, code: "reauth_required" };
  }
  return { ok: true, authenticatedAt };
}

/**
 * Require a fresh interactive authentication for sensitive mutations.
 * Uses JWT `auth_time` only — never `iat`, which rotates on token refresh
 * and would bypass step-up reauthentication.
 *
 * Uses `getUser()` (server-validated) then `getClaims()` for JWT claims —
 * never trusts `getSession().user`.
 */
export async function requireRecentAuth(
  maxAgeMs = DEFAULT_MAX_AGE_MS
): Promise<{ authenticatedAt: number }> {
  if (isDevBypassEnabled()) {
    return { authenticatedAt: Date.now() };
  }

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    throw new Error("Authentication required");
  }

  const { data: claimsData } = await supabase.auth.getClaims();
  const payload = (claimsData?.claims ?? null) as Record<string, unknown> | null;

  const decision = evaluateRecentAuthFromPayload(payload, maxAgeMs);
  if (!decision.ok) {
    const err = new Error("Reauthentication required");
    (err as Error & { code?: string }).code = decision.code;
    throw err;
  }
  return { authenticatedAt: decision.authenticatedAt };
}
