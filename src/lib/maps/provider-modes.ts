/**
 * Maps grid provider modes.
 *
 * Production: DataForSEO Maps Priority only
 * (task_post priority=2, desktop/windows, zoom 14, search_this_area=false,
 * search_places=true, depth 20). Never accept <20 items.
 *
 * ScrapingDog / Bright Data code paths remain for legacy batches and ops
 * tooling, but are not offered in the product UI and are never used as
 * fallbacks on the standard DataForSEO path.
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

/** Product UI — DataForSEO Priority only (SD / BD taken off). */
export const MAPS_PROVIDER_MODE_OPTIONS: MapsProviderModeOption[] = [
  {
    id: "dataforseo",
    label: "DataForSEO (Priority)",
    shortLabel: "DataForSEO",
    description:
      "Batch Priority Maps (desktop, zoom 14, search_this_area off). Matches Local Falcon.",
  },
];

/** Full labels for ops / legacy batch display (not shown in scan setup UI). */
const LEGACY_MODE_LABELS: Record<MapsProviderMode, string> = {
  dataforseo: "DataForSEO",
  scrapingdog: "ScrapingDog",
  hybrid: "Bright Data",
};

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
    MAPS_PROVIDER_MODE_OPTIONS.find((o) => o.id === mode)?.shortLabel ??
    LEGACY_MODE_LABELS[mode] ??
    mode
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
