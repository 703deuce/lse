/** Production always requires MFA for platform admins; cannot be disabled via env. */
export function isAdminMfaRequired(): boolean {
  if (process.env.NODE_ENV === "production") return true;
  return process.env.ADMIN_REQUIRE_MFA === "true";
}
