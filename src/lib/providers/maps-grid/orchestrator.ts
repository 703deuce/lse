/**
 * Cell-level Maps provider orchestrator.
 * Provider sequence is supplied by the caller (batch recovery decides BD vs fallback).
 */

import type { ScanDeviceProfile } from "@/lib/maps/scan-profiles";
import { runMapsProviderAdapter } from "@/lib/providers/maps-grid/adapters";
import {
  dataForSeoMapsEnabled,
  hasDataForSeoCredentials,
  hasScrapingDogCredentials,
  mapsFallbackEnabled,
  maxTotalProviderAttemptsPerCell,
  scrapingDogMapsEnabled,
} from "@/lib/providers/maps-grid/config";
import {
  isPermanentMapsFailure,
  isTransientMapsFailure,
} from "@/lib/providers/maps-grid/failure-categories";
import { getMapsProviderCircuit } from "@/lib/queue/maps-provider-circuit";
import type {
  MapsCellFetchResult,
  MapsProviderAttempt,
  MapsProviderId,
} from "@/lib/providers/maps-grid/types";

export type FetchMapsCellParams = {
  keyword: string;
  lat: number;
  lng: number;
  device: ScanDeviceProfile["device"];
  os: ScanDeviceProfile["os"];
  browser: ScanDeviceProfile["browser"];
  depth: number;
  organizationId?: string;
  /** Explicit provider chain for this call. */
  providers: MapsProviderId[];
  /** Allow one transient retry on the last/current provider before moving on. */
  allowTransientRetry?: boolean;
};

function providerEnabled(provider: MapsProviderId): boolean {
  if (provider === "brightdata") return true;
  if (provider === "dataforseo") {
    return mapsFallbackEnabled() && dataForSeoMapsEnabled() && hasDataForSeoCredentials();
  }
  if (provider === "scrapingdog") {
    return mapsFallbackEnabled() && scrapingDogMapsEnabled() && hasScrapingDogCredentials();
  }
  return false;
}

async function filterProviders(providers: MapsProviderId[]): Promise<MapsProviderId[]> {
  const out: MapsProviderId[] = [];
  for (const p of providers) {
    if (!providerEnabled(p)) continue;
    if (p === "brightdata") {
      const circuit = await getMapsProviderCircuit("brightdata");
      if (circuit.state === "open") continue;
    }
    out.push(p);
  }
  return out;
}

/**
 * Fetch a single grid cell through the supplied provider sequence.
 * Never overwrites success — returns on first valid item list.
 */
export async function fetchMapsCell(params: FetchMapsCellParams): Promise<MapsCellFetchResult> {
  const providers = await filterProviders(params.providers);
  const attempts: MapsProviderAttempt[] = [];
  const maxAttempts = maxTotalProviderAttemptsPerCell();
  let attemptBudget = 0;
  const primaryProvider: MapsProviderId = params.providers[0] ?? "brightdata";
  let fallbackReason: string | null = null;

  if (!providers.length) {
    return {
      ok: false,
      unresolvedReason: "provider_unresolved",
      primaryProvider,
      finalProvider: null,
      fallbackUsed: false,
      fallbackReason: "no_providers_available",
      attempts,
      lastCategory: "provider_unavailable",
      lastErrorMessage: "No Maps providers available for this cell",
      providerLatencyMs: 0,
    };
  }

  for (let i = 0; i < providers.length; i++) {
    const provider = providers[i];
    if (i > 0) {
      fallbackReason = fallbackReason ?? `fallback_after_${attempts[attempts.length - 1]?.category ?? "failure"}`;
    }

    const maxTries =
      params.allowTransientRetry !== false && (provider === "dataforseo" || provider === "scrapingdog")
        ? 2
        : 1;

    for (let tryNum = 1; tryNum <= maxTries; tryNum++) {
      if (attemptBudget >= maxAttempts) break;
      attemptBudget += 1;

      if (tryNum > 1) {
        const delay =
          provider === "scrapingdog"
            ? 5_000 + Math.floor(Math.random() * 7_000)
            : 5_000 + Math.floor(Math.random() * 5_000);
        await new Promise((r) => setTimeout(r, delay));
      }

      const result = await runMapsProviderAdapter(provider, {
        keyword: params.keyword,
        lat: params.lat,
        lng: params.lng,
        device: params.device,
        os: params.os,
        browser: params.browser,
        depth: params.depth,
        organizationId: params.organizationId,
        attemptNumber: tryNum,
      });
      attempts.push(result.attempt);

      if (result.ok) {
        return {
          ok: true,
          items: result.items,
          request: {
            ...result.request,
            _provenance: {
              primary_provider: primaryProvider,
              final_provider: provider,
              fallback_used: provider !== primaryProvider || i > 0,
              fallback_reason: fallbackReason,
              provider_attempts: attempts,
            },
          },
          timestamp: result.timestamp,
          primaryProvider,
          finalProvider: provider,
          fallbackUsed: i > 0 || provider !== primaryProvider,
          fallbackReason,
          attempts,
          providerLatencyMs: result.attempt.latencyMs,
        };
      }

      if (isPermanentMapsFailure(result.attempt.category)) {
        break; // next provider
      }
      if (tryNum < maxTries && isTransientMapsFailure(result.attempt.category)) {
        continue;
      }
      break;
    }
  }

  const last = attempts[attempts.length - 1];
  return {
    ok: false,
    unresolvedReason: "provider_unresolved",
    primaryProvider,
    finalProvider: last?.provider ?? null,
    fallbackUsed: attempts.some((a) => a.provider !== primaryProvider),
    fallbackReason: fallbackReason ?? last?.category ?? "all_providers_failed",
    attempts,
    lastCategory: last?.category ?? "unknown",
    lastErrorMessage: last?.errorMessage ?? "All Maps providers failed for this cell",
    providerLatencyMs: attempts.reduce((s, a) => s + a.latencyMs, 0),
  };
}

/** Bright Data only (primary / recovery / probe). */
export function brightDataOnlyProviders(): MapsProviderId[] {
  return ["brightdata"];
}

/** Secondary fallbacks after Bright Data is exhausted or circuit-open. */
export function secondaryFallbackProviders(): MapsProviderId[] {
  return ["dataforseo", "scrapingdog"];
}

/** Full chain when a cell should try everything remaining. */
export function fullFallbackProviders(): MapsProviderId[] {
  return ["brightdata", "dataforseo", "scrapingdog"];
}
