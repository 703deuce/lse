/**
 * Map internal scan/provider errors to customer-safe copy.
 * Never expose Bright Data, Redis, cookies, or stack traces in the UI.
 */
export function customerSafeScanError(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null;
  const msg = raw.trim();
  const lower = msg.toLowerCase();

  if (
    lower.includes("bright data") ||
    lower.includes("brightdata") ||
    lower.includes("serp_api") ||
    lower.includes("scrapingdog") ||
    lower.includes("dataforseo") ||
    lower.includes("api_key") ||
    lower.includes("api key") ||
    lower.includes("cookie") ||
    lower.includes("redis") ||
    lower.includes("bullmq") ||
    lower.includes("stack") ||
    lower.includes("econn") ||
    lower.includes("etimedout")
  ) {
    return "The scan hit a temporary provider issue. It will keep recovering in the background — you can leave this page and return later.";
  }

  if (lower.includes("incomplete") || lower.includes("recover")) {
    return "The scan is still completing in the background. You can leave this page and return later.";
  }

  if (
    lower.includes("location") &&
    (lower.includes("incomplete") || lower.includes("missing") || lower.includes("center"))
  ) {
    return "We could not start this scan because the business location is incomplete. Update the location and try again.";
  }

  if (lower.includes("not tracked") || lower.includes("archived")) {
    return "This location is archived or inactive. Restore it before running scheduled scans.";
  }

  // Strip obvious internals but keep short actionable text
  if (msg.length > 180 || /[{}\[\]|]/.test(msg) || lower.includes("error:")) {
    return "Something went wrong with this scan. Try again, or check that the location and keyword are set correctly.";
  }

  return msg;
}
