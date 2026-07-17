/**
 * Auth context — Supabase Auth in production, dev bypass in local development only.
 *
 * IMPORTANT (ASVS regression):
 * Session authenticity is user + org membership only — the same model that worked
 * before the ASVS pass. Do NOT call `loadOrganizationGateStatus` here.
 *
 * That helper selects `outbound_paused` (migration 057) and was wired into every
 * page/API via getAuthContext. Schema lag / PostgREST errors returned null, which
 * the ASVS code treated as "log the user out". Workers (service role) kept running
 * while the UI died ("page cannot load / reload"). Reports looked "fixed" earlier
 * only because their bug was different (requireRecentAuth + external download URLs).
 *
 * Org kill-switches belong at enqueue (`assertOrganizationCanEnqueue`), not in
 * session establishment.
 */

import { createClient } from "@/lib/supabase/server";
import {
  ensureUserOrganization,
  getOrganizationIdForUser,
} from "@/lib/auth/onboarding";
import { getDevAuthContext, isDevBypassEnabled, isDevMockAuthEnabled } from "@/lib/auth/dev";

export interface AuthContext {
  userId: string;
  organizationId: string;
  email: string | null;
  isAuthenticated: boolean;
}

function isDevBypass(): boolean {
  return isDevBypassEnabled();
}

export async function getAuthContext(): Promise<AuthContext> {
  if (isDevBypass()) {
    if (isDevMockAuthEnabled()) {
      return getDevAuthContext();
    }

    const userId = process.env.DEV_USER_ID ?? "00000000-0000-0000-0000-000000000001";

    const orgId = process.env.DEV_ORG_ID;
    if (orgId) {
      return {
        userId,
        organizationId: orgId,
        email: "dev@localhost",
        isAuthenticated: true,
      };
    }

    const { ensureDevOrganization } = await import("@/lib/auth/dev-org");
    const organizationId = await ensureDevOrganization(userId);
    return {
      userId,
      organizationId,
      email: "dev@localhost",
      isAuthenticated: true,
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      userId: "",
      organizationId: "",
      email: null,
      isAuthenticated: false,
    };
  }

  let organizationId = await getOrganizationIdForUser(user.id);
  if (!organizationId) {
    organizationId = await ensureUserOrganization(user);
  }

  return {
    userId: user.id,
    organizationId,
    email: user.email ?? null,
    isAuthenticated: true,
  };
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    throw new Error("Authentication required");
  }
  return ctx;
}
