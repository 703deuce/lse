/**
 * Google Maps API key resolution.
 *
 * Browser Maps JS keys are public by design (restrict by HTTP referrer in GCP).
 * Coolify typically sets `MAPS` at runtime. The root layout and `/api/maps/config`
 * run on the server and inject that value into the client — they must keep
 * reading `MAPS`, not only `NEXT_PUBLIC_*` (which may be absent at runtime).
 */

/** Strip Coolify/shell quoting and whitespace from secret env values. */
export function cleanApiKey(raw: string | undefined | null): string | undefined {
  if (!raw) return undefined;
  let key = raw.trim();
  // Coolify sometimes stores values as "AIza..." including the quotes.
  if (
    (key.startsWith('"') && key.endsWith('"')) ||
    (key.startsWith("'") && key.endsWith("'"))
  ) {
    key = key.slice(1, -1).trim();
  }
  return key || undefined;
}

export function apiKeySuffix(key: string | undefined): string | null {
  if (!key || key.length < 4) return null;
  return key.slice(-4);
}

type KeySource =
  | "GOOGLE_MAPS_STATIC_API_KEY"
  | "STATIC_MAPS_API_KEY"
  | "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY"
  | "NEXT_PUBLIC_MAPS"
  | "MAPS"
  | "GOOGLE_MAPS_API_KEY"
  | "GOOGLE_MAPS_KEY";

/** Key suitable to load the Maps JavaScript API in the browser. */
export function getBrowserGoogleMapsApiKey(): string | undefined {
  const key =
    cleanApiKey(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY) ||
    cleanApiKey(process.env.NEXT_PUBLIC_MAPS) ||
    // Coolify / runtime server injection (preferred deploy pattern for this app)
    cleanApiKey(process.env.MAPS) ||
    cleanApiKey(process.env.GOOGLE_MAPS_API_KEY) ||
    cleanApiKey(process.env.GOOGLE_MAPS_KEY) ||
    undefined;
  return key;
}

/**
 * Resolve a Maps key for server-side Google APIs (Static Maps, geocoding, etc.).
 * Prefers an explicit static/server key when set on the worker.
 */
export function getGoogleMapsApiKey(): string | undefined {
  return (
    cleanApiKey(process.env.GOOGLE_MAPS_STATIC_API_KEY) ||
    cleanApiKey(process.env.STATIC_MAPS_API_KEY) ||
    getBrowserGoogleMapsApiKey()
  );
}

/** Which env var supplied the server Maps key (for worker diagnostics — never log the key). */
export function getGoogleMapsApiKeySource(): KeySource | null {
  if (cleanApiKey(process.env.GOOGLE_MAPS_STATIC_API_KEY)) return "GOOGLE_MAPS_STATIC_API_KEY";
  if (cleanApiKey(process.env.STATIC_MAPS_API_KEY)) return "STATIC_MAPS_API_KEY";
  if (cleanApiKey(process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY)) return "NEXT_PUBLIC_GOOGLE_MAPS_API_KEY";
  if (cleanApiKey(process.env.NEXT_PUBLIC_MAPS)) return "NEXT_PUBLIC_MAPS";
  if (cleanApiKey(process.env.MAPS)) return "MAPS";
  if (cleanApiKey(process.env.GOOGLE_MAPS_API_KEY)) return "GOOGLE_MAPS_API_KEY";
  if (cleanApiKey(process.env.GOOGLE_MAPS_KEY)) return "GOOGLE_MAPS_KEY";
  return null;
}
