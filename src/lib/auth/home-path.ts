import { createServiceClient } from "@/lib/db/client";
import { isSmbLaunchNavEnabled } from "@/lib/product/smb-launch";

/**
 * Where to land after sign-in / visiting `/`.
 * - First login (no locations yet) → Get started
 * - SMB launch → first business overview
 * - Agency mode → Workspace
 */
export async function resolvePostLoginPath(organizationId: string): Promise<string> {
  if (!organizationId) return "/onboarding";

  const supabase = createServiceClient();
  const { data: businesses, count } = await supabase
    .from("businesses")
    .select("id", { count: "exact" })
    .eq("organization_id", organizationId)
    .is("archived_at", null)
    .order("created_at", { ascending: true })
    .limit(1);

  if (!count || count < 1) return "/onboarding";

  if (isSmbLaunchNavEnabled()) {
    const firstId = businesses?.[0]?.id;
    if (firstId) return `/businesses/${firstId}/overview`;
  }

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
