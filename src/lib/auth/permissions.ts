import { createServiceClient } from "@/lib/db/client";
import { requireAuth, type AuthContext } from "@/lib/auth/context";
import { isAdminEmail } from "@/lib/auth/admin";
import {
  normalizeOrgRole,
  roleHasPermission,
  type OrgRole,
  type Permission,
} from "@/lib/auth/permissions-core";

export type { OrgRole, Permission } from "@/lib/auth/permissions-core";
export { roleHasPermission, normalizeOrgRole } from "@/lib/auth/permissions-core";

export async function getOrganizationRole(
  organizationId: string,
  userId: string
): Promise<OrgRole | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("organization_members")
    .select("role")
    .eq("organization_id", organizationId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!data?.role) return null;
  return normalizeOrgRole(String(data.role));
}

export async function requireOrganizationPermission(
  permission: Permission,
  organizationId?: string
): Promise<AuthContext & { role: OrgRole }> {
  const auth = await requireAuth();
  const orgId = organizationId ?? auth.organizationId;
  if (!orgId) throw new Error("Access denied");

  // Platform admins may operate across orgs for admin.ops tooling only when explicitly admin.
  if (permission === "admin.ops" && isAdminEmail(auth.email)) {
    return { ...auth, role: "owner" };
  }

  if (orgId !== auth.organizationId && !isAdminEmail(auth.email)) {
    throw new Error("Access denied");
  }

  const role = await getOrganizationRole(orgId, auth.userId);
  if (!role || !roleHasPermission(role, permission)) {
    throw new Error("Access denied");
  }
  return { ...auth, organizationId: orgId, role };
}
