/**
 * Maps grid provider modes for A/B testing which stack ranks best.
 *
 * - hybrid: Bright Data burst primary + quick retries + slow waits (no provider switch)
 * - scrapingdog: every cell via ScrapingDog only (A/B)
 * - dataforseo: every cell via DataForSEO only (A/B; device=mobile|desktop + os)
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
    label: "Standard (recommended)",
    shortLabel: "Standard",
    description:
      "Fast parallel grid collection with automatic retries for unfinished points. Recommended for client work.",
  },
  {
    id: "scrapingdog",
    label: "Alternate provider A",
    shortLabel: "Alt A",
    description: "Internal A/B mode — not needed for normal freelancer scans.",
  },
  {
    id: "dataforseo",
    label: "Alternate provider B",
    shortLabel: "Alt B",
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
    case "dataforseo":
      return ["dataforseo"];
    case "hybrid":
    default:
      return ["brightdata"];
  }
}

/**
 * Secondary provider fallbacks — unused for hybrid (Bright Data only).
 * ScrapingDog/DataForSEO modes also have no secondary chain.
 */
export function secondaryProvidersForMode(_mode: MapsProviderMode): MapsProviderId[] {
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
      return ["brightdata"];
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
