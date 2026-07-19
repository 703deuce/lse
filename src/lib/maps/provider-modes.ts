/**
 * Maps grid provider modes.
 *
 * Production default: DataForSEO Maps Priority only
 * (task_post priority=2, desktop/windows, zoom 14, search_this_area=false,
 * search_places=true, depth 20). Never accept <20 items.
 *
 * ScrapingDog / Bright Data remain available for ops A/B but are not used
 * as fallbacks for the standard DataForSEO path.
 */

import type { MapsProviderId } from "@/lib/providers/maps-grid/types";

export const MAPS_PROVIDER_MODES = ["dataforseo", "scrapingdog", "hybrid"] as const;
export type MapsProviderMode = (typeof MAPS_PROVIDER_MODES)[number];

/** Production: DataForSEO Priority batch. */
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
      "Production default — batch Priority Maps (desktop, zoom 14, search_this_area off). Matches Local Falcon.",
  },
  {
    id: "scrapingdog",
    label: "ScrapingDog (ops A/B)",
    shortLabel: "ScrapingDog",
    description:
      "Ops-only A/B — not used for “near me” keywords (coverage fails). Not a production fallback.",
  },
  {
    id: "hybrid",
    label: "Bright Data (ops A/B)",
    shortLabel: "Bright Data",
    description: "Ops-only alternate — not used as a DataForSEO fallback.",
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
 * Standard DataForSEO stays pure Priority — no Bright Data mix.
 */
export function secondaryProvidersForMode(mode: MapsProviderMode): MapsProviderId[] {
  switch (mode) {
    case "dataforseo":
    case "hybrid":
    case "scrapingdog":
    default:
      return [];
  }
}

/** Integrity / last-chance chain for sparse cells — same provider only. */
export function integrityProvidersForMode(mode: MapsProviderMode): MapsProviderId[] {
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
