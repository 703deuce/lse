/**
 * Maps grid provider modes for A/B testing which stack ranks best.
 *
 * - hybrid: Bright Data primary → DataForSEO → ScrapingDog (production default)
 * - scrapingdog: every cell via ScrapingDog only
 * - dataforseo: every cell via DataForSEO only (uses device=mobile|desktop + os)
 */

import type { MapsProviderId } from "@/lib/providers/maps-grid/types";

export const MAPS_PROVIDER_MODES = ["hybrid", "scrapingdog", "dataforseo"] as const;
export type MapsProviderMode = (typeof MAPS_PROVIDER_MODES)[number];

export const DEFAULT_MAPS_PROVIDER_MODE: MapsProviderMode = "hybrid";

export type MapsProviderModeOption = {
  id: MapsProviderMode;
  label: string;
  shortLabel: string;
  description: string;
};

export const MAPS_PROVIDER_MODE_OPTIONS: MapsProviderModeOption[] = [
  {
    id: "hybrid",
    label: "Hybrid (Bright Data → DataForSEO → ScrapingDog)",
    shortLabel: "Hybrid",
    description: "Production path: Bright Data first, then DataForSEO, then ScrapingDog.",
  },
  {
    id: "scrapingdog",
    label: "ScrapingDog only",
    shortLabel: "ScrapingDog",
    description: "Run every grid cell through ScrapingDog Maps — no Bright Data.",
  },
  {
    id: "dataforseo",
    label: "DataForSEO only",
    shortLabel: "DataForSEO",
    description:
      "Run every grid cell through DataForSEO Maps Live (device=mobile + os supported).",
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
    case "dataforseo":
      return ["dataforseo"];
    case "hybrid":
    default:
      return ["brightdata"];
  }
}

/**
 * Secondary fallbacks after the primary stack is exhausted.
 * Hybrid: DataForSEO then ScrapingDog. Single-provider modes: none.
 */
export function secondaryProvidersForMode(mode: MapsProviderMode): MapsProviderId[] {
  if (mode === "hybrid") return ["dataforseo", "scrapingdog"];
  return [];
}

/** Integrity / last-chance chain for sparse cells. */
export function integrityProvidersForMode(mode: MapsProviderMode): MapsProviderId[] {
  switch (mode) {
    case "scrapingdog":
      return ["scrapingdog"];
    case "dataforseo":
      return ["dataforseo"];
    case "hybrid":
    default:
      return ["dataforseo", "scrapingdog", "brightdata"];
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
    case "dataforseo":
      return "dataforseo";
    case "hybrid":
    default:
      return "brightdata";
  }
}
