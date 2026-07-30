/** Organization is on an agency / consultant plan (vs SMB starter). */
export function isAgencyOrganizationPlan(plan?: string | null): boolean {
  const p = String(plan ?? "").trim().toLowerCase();
  return p === "agency" || p === "internal";
}
