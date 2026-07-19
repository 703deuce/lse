/**
 * Maps SERP zoom for grid rank tracking.
 *
 * Production default: **14** — matched Local Falcon in DFS Priority tests.
 * Local Falcon On-Demand API documents zoom 0–18 (API default 13); our Falcon
 * parity recipe locks 14. DataForSEO accepts 3z–21z.
 */

import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";

/** Production / Local Falcon–matching zoom. */
export const DEFAULT_MAPS_LOCATION_ZOOM = 14;

/** Zooms available for A/B in the UI. */
export const MAPS_ZOOM_OPTIONS = [13, 14, 15, 16, 17] as const;
export type MapsLocationZoom = (typeof MAPS_ZOOM_OPTIONS)[number];

export function isMapsLocationZoom(value: unknown): value is MapsLocationZoom {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    (MAPS_ZOOM_OPTIONS as readonly number[]).includes(value)
  );
}

/** Clamp to LF-compatible 0–18 (DataForSEO still gets `Nz` suffix via formatter). */
export function parseMapsLocationZoom(value: unknown): number {
  const n = typeof value === "string" ? Number(value) : value;
  if (typeof n === "number" && Number.isFinite(n)) {
    return Math.min(18, Math.max(0, Math.round(n)));
  }
  return LOCAL_FALCON_PARITY.locationZoom;
}

export function mapsZoomLabel(zoom: number): string {
  if (zoom === 14) return "14 (recommended / Falcon match)";
  if (zoom === 13) return "13 (Local Falcon API default)";
  if (zoom === 17) return "17 (tight neighborhood)";
  return String(zoom);
}
