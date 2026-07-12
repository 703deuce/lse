const TRACKING_PARAMS = new Set([
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "fbclid",
  "gclid",
  "msclkid",
]);

export function canonicalizeUrl(url: string): string {
  try {
    const u = new URL(url.trim());
    u.hash = "";
    for (const key of [...u.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) {
        u.searchParams.delete(key);
      }
    }
    u.hostname = u.hostname.replace(/^www\./i, "").toLowerCase();
    let path = u.pathname;
    if (path.length > 1 && path.endsWith("/")) {
      path = path.slice(0, -1);
    }
    const search = u.searchParams.toString();
    const qs = search ? `?${search}` : "";
    return `${u.protocol}//${u.hostname}${path}${qs}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function contentHash(text: string): string {
  let hash = 0;
  const s = text.slice(0, 8000);
  for (let i = 0; i < s.length; i++) {
    hash = (hash << 5) - hash + s.charCodeAt(i);
    hash |= 0;
  }
  return String(hash);
}
