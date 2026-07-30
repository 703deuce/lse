/** UUID v4 pattern — dashboard path segments must match before treating them as entity ids. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function segmentLooksLikeEntityId(segment: string | undefined): boolean {
  return segment != null && UUID_RE.test(segment);
}

/**
 * Resolve business / client / prospect id from dashboard pathname.
 * Static routes like `/prospects/audits` are excluded (segment is not a UUID).
 */
export function businessIdFromDashboardPath(pathname: string): string | undefined {
  const business = pathname.match(/^\/businesses\/([^/]+)/);
  if (business?.[1] && business[1] !== "new" && segmentLooksLikeEntityId(business[1])) {
    return business[1];
  }
  const client = pathname.match(/^\/clients\/([^/]+)/);
  if (client?.[1] && segmentLooksLikeEntityId(client[1])) return client[1];
  const prospect = pathname.match(/^\/prospects\/([^/]+)/);
  if (prospect?.[1] && segmentLooksLikeEntityId(prospect[1])) return prospect[1];
  return undefined;
}
