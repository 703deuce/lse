import { resolveLifecycleHomePath } from "@/lib/workflow/lifecycle";

/**
 * Where to land after sign-in / visiting `/`.
 * - First login (no locations yet) → Get started / reputation setup
 * - Otherwise → Reputation Overview for the primary business
 */
export async function resolvePostLoginPath(organizationId: string): Promise<string> {
  return resolveLifecycleHomePath(organizationId);
}

/**
 * Soft home destinations — resolve to lifecycle home (onboarding or Reputation Overview).
 * Explicit hubs (/workspace, /clients, /prospects, /scans, …) are honored as-is.
 */
export function isSoftHomePath(path: string): boolean {
  const bare = path.split("?")[0] ?? path;
  return bare === "/" || bare === "/businesses" || bare === "/dashboard";
}
