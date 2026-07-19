import { createServiceClient } from "@/lib/db/client";

/**
 * Where to land after sign-in / visiting `/`.
 * - First login (no locations yet) → Get started
 * - Otherwise → Workspace (never a random client page)
 */
export async function resolvePostLoginPath(organizationId: string): Promise<string> {
  if (!organizationId) return "/onboarding";

  const supabase = createServiceClient();
  const { count } = await supabase
    .from("businesses")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", organizationId)
    .is("archived_at", null);

  if (!count || count < 1) return "/onboarding";
  return "/workspace";
}

/**
 * Soft home destinations — still run first-login vs Workspace resolution.
 * Deep links and real hubs (/clients, /prospects, /scans, …) are honored as-is.
 */
export function isSoftHomePath(path: string): boolean {
  const bare = path.split("?")[0] ?? path;
  return (
    bare === "/" ||
    bare === "/businesses" ||
    bare === "/dashboard" ||
    bare === "/workspace"
  );
}
