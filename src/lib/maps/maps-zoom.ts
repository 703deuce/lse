/**
 * Maps SERP zoom for grid rank tracking.
 *
 * Local Falcon On-Demand API (`ranking-at-coordinate` / `keyword-at-coordinate`):
 * zoom is optional, range 0–18, **defaults to 13**
 * (docs.localfalcon.com/openapi.yaml).
 *
 * DataForSEO accepts 3z–21z. We expose the LF-comparable band for A/B tests.
 */

import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";

/** Local Falcon API default — use this unless the user overrides for A/B. */
export const DEFAULT_MAPS_LOCATION_ZOOM = 13;

/** Common zooms to A/B against Local Falcon / DataForSEO. */
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
  if (zoom === 13) return "13 (Local Falcon default)";
  if (zoom === 17) return "17 (tight neighborhood)";
  return String(zoom);
}
