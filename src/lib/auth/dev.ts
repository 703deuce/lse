import type { AuthContext } from "@/lib/auth/context";

export const DEV_PREVIEW_BUSINESS_ID = process.env.DEV_BUSINESS_ID ?? "preview";

export function isDevBypassEnabled(): boolean {
  return process.env.NODE_ENV === "development" && process.env.DEV_BYPASS_AUTH === "true";
}

export function isDevMockAuthEnabled(): boolean {
  return isDevBypassEnabled() && process.env.DEV_MOCK_AUTH !== "false";
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
  return `/businesses/${DEV_PREVIEW_BUSINESS_ID}/reviews`;
}
