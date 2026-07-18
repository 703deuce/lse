/**
 * After a Maps scan is queued, leave the setup/grid wait UI and show the
 * dashboard in-progress card. Uses location.replace so nothing can race the
 * user back onto /grid/{scanId}.
 */
export function dashboardPathAfterScanStart(businessId: string): string {
  return `/businesses/${businessId}/overview`;
}

export function goToDashboardAfterScanStart(businessId: string): void {
  if (typeof window === "undefined") return;
  const path = dashboardPathAfterScanStart(businessId);
  // replace (not assign/push) — prevents back-button / race back to the grid wait page.
  window.location.replace(path);
}
