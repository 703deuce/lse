export type OrgRole = "owner" | "admin" | "member" | "readonly";

export type Permission =
  | "business.read"
  | "business.update"
  | "scan.run"
  | "scan.read"
  | "report.create"
  | "report.share"
  | "contacts.read"
  | "contacts.import"
  | "contacts.export"
  | "campaign.send"
  | "billing.read"
  | "integration.manage"
  | "api_key.manage"
  | "member.invite"
  | "member.manage"
  | "org.delete"
  | "admin.ops";

const ROLE_RANK: Record<OrgRole, number> = {
  owner: 40,
  admin: 30,
  member: 20,
  readonly: 10,
};

/** Minimum role required for each permission. */
const PERMISSION_MIN_ROLE: Record<Permission, OrgRole> = {
  "business.read": "readonly",
  "business.update": "member",
  "scan.run": "member",
  "scan.read": "readonly",
  "report.create": "member",
  "report.share": "member",
  "contacts.read": "member",
  "contacts.import": "member",
  "contacts.export": "member",
  "campaign.send": "member",
  "billing.read": "member",
  "integration.manage": "admin",
  "api_key.manage": "admin",
  "member.invite": "admin",
  "member.manage": "owner",
  "org.delete": "owner",
  "admin.ops": "owner",
};

export function roleHasPermission(role: OrgRole, permission: Permission): boolean {
  const min = PERMISSION_MIN_ROLE[permission];
  return ROLE_RANK[role] >= ROLE_RANK[min];
}

export function normalizeOrgRole(role: string | null | undefined): OrgRole {
  if (role === "owner" || role === "admin" || role === "readonly") return role;
  return "member";
}
