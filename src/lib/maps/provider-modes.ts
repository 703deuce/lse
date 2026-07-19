/**
 * Maps grid provider modes.
 *
 * - dataforseo: DataForSEO Maps Live Advanced (standard / recommended)
 * - hybrid: Bright Data (alternate)
 * - scrapingdog: ScrapingDog (alternate A/B)
 *
 * DataForSEO is the primary Maps scraper. The Live Advanced client
 * (serp/google/maps/live/advanced) with location_coordinate `lat,lng,17z`
 * and search_this_area parity is the path that previously worked in
 * scripts/compare-grid-providers.mjs (Jul 2026 comparison run).
 */

import type { MapsProviderId } from "@/lib/providers/maps-grid/types";

export const MAPS_PROVIDER_MODES = ["hybrid", "scrapingdog", "dataforseo"] as const;
export type MapsProviderMode = (typeof MAPS_PROVIDER_MODES)[number];

/** Standard scans use DataForSEO Maps Live Advanced. */
export const DEFAULT_MAPS_PROVIDER_MODE: MapsProviderMode = "dataforseo";

export type MapsProviderModeOption = {
  id: MapsProviderMode;
  label: string;
  shortLabel: string;
  description: string;
};

export const MAPS_PROVIDER_MODE_OPTIONS: MapsProviderModeOption[] = [
  {
    id: "dataforseo",
    label: "Standard (DataForSEO)",
    shortLabel: "Standard",
    description:
      "Google Maps Live Advanced via DataForSEO — the default grid scraper for client work.",
  },
  {
    id: "hybrid",
    label: "Bright Data (alternate)",
    shortLabel: "Bright Data",
    description: "Alternate provider for A/B or when DataForSEO is unavailable.",
  },
  {
    id: "scrapingdog",
    label: "ScrapingDog (alternate)",
    shortLabel: "ScrapingDog",
    description: "Internal A/B mode — not needed for normal freelancer scans.",
  },
];

export function isMapsProviderMode(value: unknown): value is MapsProviderMode {
  return (
    typeof value === "string" &&
    (MAPS_PROVIDER_MODES as readonly string[]).includes(value)
  );
}

export function parseMapsProviderMode(value: unknown): MapsProviderMode {
  return isMapsProviderMode(value) ? value : DEFAULT_MAPS_PROVIDER_MODE;
}

/** Primary provider chain for the first pass (and sole chain for single-provider modes). */
export function primaryProvidersForMode(mode: MapsProviderMode): MapsProviderId[] {
  switch (mode) {
    case "scrapingdog":
      return ["scrapingdog"];
    case "hybrid":
      return ["brightdata"];
    case "dataforseo":
    default:
      return ["dataforseo"];
  }
}

/**
 * Secondary provider fallbacks after the primary chain is exhausted.
 * Standard (DataForSEO) can optionally try Bright Data when fallback is enabled.
 */
export function secondaryProvidersForMode(mode: MapsProviderMode): MapsProviderId[] {
  switch (mode) {
    case "dataforseo":
      return ["brightdata"];
    case "hybrid":
    case "scrapingdog":
    default:
      return [];
  }
}

/** Integrity / last-chance chain for sparse cells. */
export function integrityProvidersForMode(mode: MapsProviderMode): MapsProviderId[] {
  switch (mode) {
    case "scrapingdog":
      return ["scrapingdog"];
    case "hybrid":
      return ["brightdata"];
    case "dataforseo":
    default:
      return ["dataforseo", "brightdata"];
  }
}

export function mapsProviderModeLabel(mode: MapsProviderMode): string {
  return (
    MAPS_PROVIDER_MODE_OPTIONS.find((o) => o.id === mode)?.shortLabel ?? mode
  );
}

/** Column value stored on scan_batches.provider for ops visibility. */
export function scanBatchProviderColumn(mode: MapsProviderMode): string {
  switch (mode) {
    case "scrapingdog":
      return "scrapingdog";
    case "hybrid":
      return "brightdata";
    case "dataforseo":
    default:
      return "dataforseo";
  }
}
