/**
 * Fixed scan settings that matched Local Falcon in controlled DFS tests
 * (5×5 / 7×7, "near me" keywords, full 20-pack coverage).
 *
 * Production path: DataForSEO Maps Priority (task_post priority=2), not Live.
 */
import { DEFAULT_GRID_SIZE, DEFAULT_RADIUS_METERS } from "@/lib/maps/grid-metrics";
import { DEFAULT_SCAN_PROFILE, MAPS_LANGUAGE, MAPS_LIVE_ENDPOINT } from "@/lib/maps/scan-profiles";

export const LOCAL_FALCON_PARITY = {
  /** DataForSEO Google Maps (not Local Finder / organic local pack) */
  searchEngine: "google_maps" as const,
  /** Live endpoint label for debug meta only — grids use task_post Priority. */
  endpoint: MAPS_LIVE_ENDPOINT,
  /**
   * Critical: search_this_area=true at typical zooms clipped packs to 0–15
   * and caused not-found holes. false → full top-20 every cell in Falcon tests.
   */
  searchThisArea: false,
  /**
   * Keep true for local-intent Maps behavior (Falcon-matching recipe).
   * Do not rewrite "near me" keywords — DFS handles them natively.
   */
  searchPlaces: true,
  /** United States */
  seDomain: "google.com",
  languageCode: MAPS_LANGUAGE,
  countryCode: "US",
  /**
   * Zoom 14 matched Local Falcon well. DFS ranks were nearly identical across
   * 13–20; 14 is the fixed production choice (override in UI for A/B).
   */
  locationZoom: 14,
  /** Full top-20 pack */
  gridDepth: 20,
  gridSize: DEFAULT_GRID_SIZE,
  radiusMeters: DEFAULT_RADIUS_METERS,
  /** Desktop matched Falcon; mobile under-ranked west-side pins by ~1. */
  device: DEFAULT_SCAN_PROFILE.device,
  os: DEFAULT_SCAN_PROFILE.os,
  browser: DEFAULT_SCAN_PROFILE.browser,
} as const;

/** Never flip STA back on for grids — recipe is always false. */
export const SEARCH_THIS_AREA_FALLBACK = false;

export function isNoSearchResultsError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return msg.includes("40102") || msg.toLowerCase().includes("no search results");
}
