/**
 * SMB launch mode: hide agency/workspace/client-management chrome from the
 * primary customer experience without deleting those features.
 *
 * Set NEXT_PUBLIC_NAV_MODE=agency to restore the consultant/agency sidebar.
 */
export function isSmbLaunchNavEnabled(): boolean {
  const mode = (process.env.NEXT_PUBLIC_NAV_MODE ?? "smb").trim().toLowerCase();
  return mode !== "agency";
}
