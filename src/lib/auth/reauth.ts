import { createClient } from "@/lib/supabase/server";
import { isDevBypassEnabled } from "@/lib/auth/dev";

const DEFAULT_MAX_AGE_MS = Number(process.env.SENSITIVE_REAUTH_MAX_AGE_MS ?? 60 * 60 * 1000);

/**
 * Resolve when the user last interactively authenticated.
 * Prefer OIDC `auth_time`, then Supabase `amr[].timestamp`.
 * Never use bare `iat` for aal1 — access-token refresh would bypass step-up.
 */
export function sessionAuthenticatedAtMs(
  payload: Record<string, unknown> | null
): number | null {
  if (!payload) return null;

  if (typeof payload.auth_time === "number" && Number.isFinite(payload.auth_time)) {
    return payload.auth_time * 1000;
  }

  const amr = payload.amr;
  if (Array.isArray(amr)) {
    let maxTs = 0;
    for (const entry of amr) {
      if (
        entry &&
        typeof entry === "object" &&
        typeof (entry as { timestamp?: unknown }).timestamp === "number"
      ) {
        maxTs = Math.max(maxTs, (entry as { timestamp: number }).timestamp);
      }
    }
    if (maxTs > 0) return maxTs * 1000;
  }

  // MFA step-up: allow recent iat only when already at aal2.
  if (payload.aal === "aal2" && typeof payload.iat === "number") {
    return payload.iat * 1000;
  }

  return null;
}

/** Testable reauth decision from JWT claims. */
export function evaluateRecentAuthFromPayload(
  payload: Record<string, unknown> | null,
  maxAgeMs = DEFAULT_MAX_AGE_MS
): { ok: true; authenticatedAt: number } | { ok: false; code: "reauth_required" } {
  const authenticatedAt = sessionAuthenticatedAtMs(payload);
  if (authenticatedAt == null) {
    return { ok: false, code: "reauth_required" };
  }
  if (Date.now() - authenticatedAt > maxAgeMs) {
    return { ok: false, code: "reauth_required" };
  }
  return { ok: true, authenticatedAt };
}

/**
 * Require a fresh interactive authentication for sensitive mutations.
 * Uses `getUser()` then `getClaims()` — never trusts `getSession().user`.
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
