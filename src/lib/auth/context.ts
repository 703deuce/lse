/**
 * Auth stub — Firebase will replace this.
 * When DEV_BYPASS_AUTH=true, uses fixed dev user/org from env.
 */

export interface AuthContext {
  userId: string;
  organizationId: string;
  email: string | null;
  isAuthenticated: boolean;
}

export async function getAuthContext(): Promise<AuthContext> {
  const bypass = process.env.DEV_BYPASS_AUTH === "true";
  const userId = process.env.DEV_USER_ID ?? "00000000-0000-0000-0000-000000000001";

  if (bypass) {
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

  // TODO: Firebase token verification
  throw new Error("Authentication required. Firebase auth not yet configured.");
}

export async function requireAuth(): Promise<AuthContext> {
  const ctx = await getAuthContext();
  if (!ctx.isAuthenticated) {
    throw new Error("Unauthorized");
  }
  return ctx;
}
