/**
 * Auth context — Supabase Auth in production, dev bypass in local development only.
 */

import { createClient } from "@/lib/supabase/server";
import {
  ensureUserOrganization,
  getOrganizationIdForUser,
} from "@/lib/auth/onboarding";
import { getDevAuthContext, isDevBypassEnabled, isDevMockAuthEnabled } from "@/lib/auth/dev";
import {
  isOrganizationAccessBlocked,
  loadOrganizationGateStatus,
} from "@/lib/auth/org-status";

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

  const orgGate = await loadOrganizationGateStatus(organizationId);
  if (!orgGate || isOrganizationAccessBlocked(orgGate.status)) {
    return {
      userId: "",
      organizationId: "",
      email: null,
      isAuthenticated: false,
    };
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
