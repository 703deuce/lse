/**
 * Same-origin checks for cookie-authenticated mutating API requests.
 * Webhooks / cron / bearer-only routes should be excluded by the caller.
 */

function parseOriginHost(value: string | null): string | null {
  if (!value) return null;
  try {
    return new URL(value).host.toLowerCase();
  } catch {
    return null;
  }
}

export function isMutatingMethod(method: string): boolean {
  const m = method.toUpperCase();
  return m === "POST" || m === "PUT" || m === "PATCH" || m === "DELETE";
}

/** Paths that authenticate via shared secret / signature — skip browser CSRF. */
export function isCsrfExemptPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/webhooks/") ||
    pathname === "/api/jobs/process" ||
    pathname.startsWith("/api/automations/") ||
    pathname.startsWith("/auth/")
  );
}

/**
 * Returns false when Origin/Referer is present and does not match the request host.
 * Missing Origin+Referer is allowed (non-browser clients / curl with Bearer).
 */
export function isSameOriginMutation(request: {
  method: string;
  url: string;
  headers: { get(name: string): string | null };
}): boolean {
  if (!isMutatingMethod(request.method)) return true;

  const requestHost = parseOriginHost(request.url);
  if (!requestHost) return true;

  const originHost = parseOriginHost(request.headers.get("origin"));
  if (originHost) return originHost === requestHost;

  const refererHost = parseOriginHost(request.headers.get("referer"));
  if (refererHost) return refererHost === requestHost;

  return true;
}
