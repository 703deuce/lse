import { createClient } from "@/lib/supabase/server";
import { isDevBypassEnabled } from "@/lib/auth/dev";

const DEFAULT_MAX_AGE_MS = Number(process.env.SENSITIVE_REAUTH_MAX_AGE_MS ?? 15 * 60 * 1000);

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const parts = token.split(".");
    if (parts.length < 2) return null;
    const json = Buffer.from(parts[1], "base64url").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/**
 * Require a fresh session for sensitive mutations (ASVS reauthentication).
 * Uses access-token `iat` (or auth_time). Clients should re-login / MFA challenge
 * when they receive 401 with code=reauth_required.
 */
export async function requireRecentAuth(
  maxAgeMs = DEFAULT_MAX_AGE_MS
): Promise<{ authenticatedAt: number }> {
  if (isDevBypassEnabled()) {
    return { authenticatedAt: Date.now() };
  }

  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session?.access_token) {
    throw new Error("Authentication required");
  }

  const payload = decodeJwtPayload(session.access_token);
  const authTimeSec =
    typeof payload?.auth_time === "number"
      ? payload.auth_time
      : typeof payload?.iat === "number"
        ? payload.iat
        : null;
  if (authTimeSec == null) {
    throw new Error("Reauthentication required");
  }
  const authenticatedAt = authTimeSec * 1000;
  if (Date.now() - authenticatedAt > maxAgeMs) {
    const err = new Error("Reauthentication required");
    (err as Error & { code?: string }).code = "reauth_required";
    throw err;
  }
  return { authenticatedAt };
}
