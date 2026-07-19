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
  /**
   * Production A/B (Tampa 7×7): search_this_area=true + zoom 17 clipped the
   * viewport so hard that many cells returned 0–15 pins. With
   * search_this_area=false every cell returned a full top-20 pack.
   * Keep false for DataForSEO grid rank tracking.
   */
  searchThisArea: false,
  /**
   * DataForSEO docs: search_places=true can interfere with local-intent
   * keywords and return the wrong/sparse pack. Keep false for grids.
   */
  searchPlaces: false,
  /** United States */
  seDomain: "google.com",
  languageCode: MAPS_LANGUAGE,
  countryCode: "US",
  /**
   * Local Falcon On-Demand API default zoom is 13 (range 0–18).
   * DataForSEO default when omitted is 17z — that was clipping packs too tight.
   * Override per scan for A/B (13–17).
   */
  locationZoom: 13,
  /** LF reports top-20 pack; mobile Maps SERP max is 20 results */
  gridDepth: 20,
  gridSize: DEFAULT_GRID_SIZE,
  radiusMeters: DEFAULT_RADIUS_METERS,
  device: DEFAULT_SCAN_PROFILE.device,
  os: DEFAULT_SCAN_PROFILE.os,
  browser: DEFAULT_SCAN_PROFILE.browser,
} as const;

/** Legacy Live STA flip — grids use searchThisArea=false by default now. */
export const SEARCH_THIS_AREA_FALLBACK = false;

export function isNoSearchResultsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("40102") || msg.toLowerCase().includes("no search results");
}
