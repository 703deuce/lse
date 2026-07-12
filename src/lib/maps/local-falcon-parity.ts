/**
 * Fixed scan settings aligned with Local Falcon grid reports.
 * All grid scans use these defaults — no per-run toggles in the UI.
 */
import { DEFAULT_GRID_SIZE, DEFAULT_RADIUS_METERS } from "@/lib/maps/grid-metrics";
import { DEFAULT_SCAN_PROFILE, MAPS_LANGUAGE, MAPS_LIVE_ENDPOINT } from "@/lib/maps/scan-profiles";

export const LOCAL_FALCON_PARITY = {
  /** DataForSEO Google Maps Live (not Local Finder / organic local pack) */
  searchEngine: "google_maps" as const,
  endpoint: MAPS_LIVE_ENDPOINT,
  /** LF uses Maps “search this area” viewport — DataForSEO default true */
  searchThisArea: true,
  /** DataForSEO default; keeps local-intent keyword behavior on Maps */
  searchPlaces: true,
  /** United States */
  seDomain: "google.com",
  languageCode: MAPS_LANGUAGE,
  countryCode: "US",
  /** DataForSEO default zoom when omitted; matches Maps pin viewport */
  locationZoom: 17,
  /** LF reports top-20 pack; mobile Maps SERP max is 20 results */
  gridDepth: 20,
  gridSize: DEFAULT_GRID_SIZE,
  radiusMeters: DEFAULT_RADIUS_METERS,
  device: DEFAULT_SCAN_PROFILE.device,
  os: DEFAULT_SCAN_PROFILE.os,
  browser: DEFAULT_SCAN_PROFILE.browser,
} as const;

/** Edge grid pins on mobile return 40102 when search_this_area=true — retry once with this */
export const SEARCH_THIS_AREA_FALLBACK = false;

export function isNoSearchResultsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("40102") || msg.toLowerCase().includes("no search results");
}
