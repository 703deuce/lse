/**
 * Maps grid provider modes (A/B).
 *
 * - dataforseo: DataForSEO Maps Priority (default)
 * - scrapingdog: ScrapingDog google_maps with ll=@lat,lng,17z
 * - hybrid: Bright Data (alternate)
 *
 * DataForSEO grids: task_post priority=2, location_coordinate lat,lng,17z,
 * search_this_area=false, search_places=false. Never accept <20 items.
 */

import type { MapsProviderId } from "@/lib/providers/maps-grid/types";

export const MAPS_PROVIDER_MODES = ["dataforseo", "scrapingdog", "hybrid"] as const;
export type MapsProviderMode = (typeof MAPS_PROVIDER_MODES)[number];

/** Default: DataForSEO Priority batch. */
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
    label: "DataForSEO (Priority)",
    shortLabel: "DataForSEO",
    description:
      "Queued Maps Priority — full grid in one POST. search_this_area off so cells return a full top-20 pack.",
  },
  {
    id: "scrapingdog",
    label: "ScrapingDog",
    shortLabel: "ScrapingDog",
    description:
      "A/B alternate — Google Maps via ScrapingDog with ll=@lat,lng,17z per pin.",
  },
  {
    id: "hybrid",
    label: "Bright Data",
    shortLabel: "Bright Data",
    description: "Bright Data only — use when comparing against SERP API vendors.",
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
 * DataForSEO can optionally try Bright Data when fallback is enabled.
 * ScrapingDog stays single-provider so A/B results stay pure.
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
