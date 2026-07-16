/** Map enroll/validate skip reasons onto webhook event statuses. */
export function mapEnrollmentSkipStatus(reason: string | null | undefined): string {
  const r = (reason ?? "").toLowerCase();
  if (
    r.includes("opt") ||
    r.includes("suppress") ||
    r.includes("unsubscrib") ||
    r.includes("consent")
  ) {
    return "ignored_suppressed";
  }
  if (r.includes("recent") || r.includes("contacted in last")) {
    return "ignored_recently_requested";
  }
  if (r.includes("duplicate") || r.includes("already") || r.includes("skip")) {
    return "ignored_duplicate";
  }
  return "ignored_duplicate";
}
