/**
 * Google Maps API key resolution.
 *
 * Browser Maps JS keys are public by design (restrict by HTTP referrer in GCP).
 * Coolify typically sets `MAPS` at runtime. The root layout and `/api/maps/config`
 * run on the server and inject that value into the client — they must keep
 * reading `MAPS`, not only `NEXT_PUBLIC_*` (which may be absent at runtime).
 */

/** Key suitable to load the Maps JavaScript API in the browser. */
export function getBrowserGoogleMapsApiKey(): string | undefined {
  const key =
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_MAPS?.trim() ||
    // Coolify / runtime server injection (preferred deploy pattern for this app)
    process.env.MAPS?.trim() ||
    process.env.GOOGLE_MAPS_API_KEY?.trim() ||
    process.env.GOOGLE_MAPS_KEY?.trim() ||
    "";
  return key || undefined;
}

/**
 * Resolve a Maps key for server-side Google APIs (Static Maps, geocoding, etc.).
 * Same sources as the browser key for this deployment.
 */
export function getGoogleMapsApiKey(): string | undefined {
  return getBrowserGoogleMapsApiKey();
}
