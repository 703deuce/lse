/**
 * Browser-safe Maps JavaScript API key only.
 * Never prefer server-only `MAPS` / `GOOGLE_MAPS_API_KEY` for public responses.
 */
export function getBrowserGoogleMapsApiKey(): string | undefined {
  const key =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_MAPS?.trim() ||
    "";
  return key || undefined;
}

/**
 * Resolve a Maps key for server-side Google APIs (geocoding, etc.).
 * Prefer server secrets; fall back to the browser key when that is all that is configured.
 */
export function getGoogleMapsApiKey(): string | undefined {
  const key =
    process.env.MAPS?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_KEY?.trim() ||
    getBrowserGoogleMapsApiKey() ||
    "";
  return key || undefined;
}
