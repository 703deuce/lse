import type { AuthContext } from "@/lib/auth/context";

export const DEV_PREVIEW_BUSINESS_ID = process.env.DEV_BUSINESS_ID ?? "preview";

/**
 * TEMPORARY: login walls are disabled so the app can be used without signing in.
 * Auth code in middleware / requireAuth / Supabase is kept — this only short-circuits it.
 *
 * Restore normal login by either:
 *   - setting AUTH_LOGIN_REQUIRED=true, or
 *   - restoring the original return below:
 *     return process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "true";
 */
export function isDevBypassEnabled(): boolean {
  if (process.env.AUTH_LOGIN_REQUIRED === "true") return false;
  // Never bypass on a real production deploy.
  if (process.env.NODE_ENV === "production" && process.env.VERCEL_ENV === "production") {
    return false;
  }
  return (
    process.env.DEV_BYPASS_AUTH === "true" ||
    process.env.NEXT_PUBLIC_DEV_BYPASS_AUTH === "true" ||
    process.env.NODE_ENV === "development"
  );
}

/**
 * TEMPORARY: mock fake UUIDs are OFF unless DEV_MOCK_AUTH=true.
 * That way existing users/orgs/businesses still resolve via DEV_USER_ID / ensureDevOrganization.
 * ORIGINAL: return isDevBypassEnabled() && process.env.DEV_MOCK_AUTH !== "false";
 */
export function isDevMockAuthEnabled(): boolean {
  return isDevBypassEnabled() && process.env.DEV_MOCK_AUTH === "true";
}

export function isDevPreviewBusiness(businessId: string): boolean {
  return isDevBypassEnabled() && businessId === DEV_PREVIEW_BUSINESS_ID;
}

export function getDevAuthContext(): AuthContext {
  return {
    userId: process.env.DEV_USER_ID ?? "00000000-0000-0000-0000-000000000001",
    organizationId: process.env.DEV_ORG_ID ?? "00000000-0000-0000-0000-000000000002",
    email: "dev@localhost",
    isAuthenticated: true,
  };
}

export function getDevDefaultAppPath(): string {
  return "/workspace";
}
