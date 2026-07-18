/**
 * Maps grid multi-provider configuration.
 * All tunables live here as env-backed getters — no scattered magic numbers.
 */

function envInt(name: string, fallback: number, opts?: { min?: number; max?: number }): number {
  const n = Number(process.env[name] ?? fallback);
  if (!Number.isFinite(n)) return fallback;
  const min = opts?.min ?? Number.NEGATIVE_INFINITY;
  const max = opts?.max ?? Number.POSITIVE_INFINITY;
  return Math.min(max, Math.max(min, Math.floor(n)));
}

function envBool(name: string, fallback: boolean): boolean {
  const raw = process.env[name];
  if (raw == null || raw === "") return fallback;
  return /^(1|true|yes|on)$/i.test(raw.trim());
}

/** Bright Data global in-flight concurrency for Maps cells (across workers). */
export function brightDataGlobalConcurrency(): number {
  return envInt("BRIGHTDATA_GLOBAL_CONCURRENCY", 25, { min: 1, max: 250 });
}

export function brightDataNormalCellTimeoutMs(): number {
  return envInt("BRIGHTDATA_NORMAL_CELL_TIMEOUT_MS", 45_000, { min: 5_000, max: 180_000 });
}

export function brightDataDegradedThresholdPercent(): number {
  return envInt("BRIGHTDATA_DEGRADED_THRESHOLD_PERCENT", 25, { min: 1, max: 100 });
}

export function brightDataDegradedMinFailures(): number {
  return envInt("BRIGHTDATA_DEGRADED_MIN_FAILURES", 5, { min: 1, max: 500 });
}

export function brightDataDegradedWindowMs(): number {
  return envInt("BRIGHTDATA_DEGRADED_WINDOW_MS", 20_000, { min: 1_000, max: 300_000 });
}

export function brightDataIsolatedRetryConcurrency(): number {
  return envInt("BRIGHTDATA_ISOLATED_RETRY_CONCURRENCY", 5, { min: 1, max: 25 });
}

export function brightDataIsolatedRetryDelayMinMs(): number {
  return envInt("BRIGHTDATA_ISOLATED_RETRY_DELAY_MIN_MS", 2_000, { min: 0, max: 60_000 });
}

export function brightDataIsolatedRetryDelayMaxMs(): number {
  return envInt("BRIGHTDATA_ISOLATED_RETRY_DELAY_MAX_MS", 5_000, { min: 0, max: 120_000 });
}

export function brightDataRecoveryDelayMinMs(): number {
  return envInt("BRIGHTDATA_RECOVERY_DELAY_MIN_MS", 12_000, { min: 0, max: 180_000 });
}

export function brightDataRecoveryDelayMaxMs(): number {
  return envInt("BRIGHTDATA_RECOVERY_DELAY_MAX_MS", 20_000, { min: 0, max: 300_000 });
}

export function brightDataProbeCount(): number {
  return envInt("BRIGHTDATA_PROBE_COUNT", 3, { min: 1, max: 10 });
}

export function brightDataProbeConcurrency(): number {
  return envInt("BRIGHTDATA_PROBE_CONCURRENCY", 2, { min: 1, max: 5 });
}

export function brightDataProbeSuccessMin(): number {
  return envInt("BRIGHTDATA_PROBE_SUCCESS_MIN", 2, { min: 1, max: 10 });
}

export function brightDataHalfOpenConcurrency(): number {
  return envInt("BRIGHTDATA_HALF_OPEN_CONCURRENCY", 5, { min: 1, max: 50 });
}

export function brightDataHalfOpenRampConcurrency(): number {
  return envInt("BRIGHTDATA_HALF_OPEN_RAMP_CONCURRENCY", 10, { min: 1, max: 100 });
}

/**
 * After the primary Bright Data wave, wait this long before each delayed
 * Bright Data retry of unfinished cells (tests rate-limit / cooldown theory).
 */
export function brightDataDelayedRetryDelayMs(): number {
  return envInt("BRIGHTDATA_DELAYED_RETRY_DELAY_MS", 30_000, { min: 0, max: 300_000 });
}

/** How many pause → Bright Data retry rounds after the primary wave. */
export function brightDataDelayedRetryRounds(): number {
  return envInt("BRIGHTDATA_DELAYED_RETRY_ROUNDS", 2, { min: 0, max: 5 });
}

export function brightDataCircuitLeaseMs(): number {
  return envInt("BRIGHTDATA_CIRCUIT_LEASE_MS", 120_000, { min: 10_000, max: 900_000 });
}

export function dataForSeoMapsEnabled(): boolean {
  return envBool("DATAFORSEO_MAPS_ENABLED", true);
}

export function dataForSeoMapsConcurrency(): number {
  // No hardcoded "10" — require explicit config, else a conservative default
  // only when credentials exist. Operators should set the verified account value.
  return envInt("DATAFORSEO_MAPS_CONCURRENCY", 8, { min: 1, max: 100 });
}

export function dataForSeoMapsMaxTasksPerPost(): number {
  return envInt("DATAFORSEO_MAPS_MAX_TASKS_PER_POST", 100, { min: 1, max: 100 });
}

export function dataForSeoMapsTimeoutMs(): number {
  return envInt("DATAFORSEO_MAPS_TIMEOUT_MS", 60_000, { min: 5_000, max: 180_000 });
}

export function scrapingDogMapsEnabled(): boolean {
  return envBool("SCRAPINGDOG_MAPS_ENABLED", true);
}

export function scrapingDogMapsConcurrency(): number {
  // Plan-specific — must be set to the account dashboard value in production.
  return envInt("SCRAPINGDOG_MAPS_CONCURRENCY", 5, { min: 1, max: 100 });
}

export function scrapingDogMapsTimeoutMs(): number {
  return envInt("SCRAPINGDOG_MAPS_TIMEOUT_MS", 45_000, { min: 5_000, max: 180_000 });
}

export function maxTotalProviderAttemptsPerCell(): number {
  return envInt("MAX_TOTAL_PROVIDER_ATTEMPTS_PER_CELL", 6, { min: 1, max: 20 });
}

export function mapsFallbackEnabled(): boolean {
  return envBool("MAPS_GRID_FALLBACK_ENABLED", true);
}

export function hasDataForSeoCredentials(): boolean {
  return Boolean(process.env.DATAFORSEO_USERNAME?.trim() && process.env.DATAFORSEO_PASSWORD?.trim());
}

export function hasScrapingDogCredentials(): boolean {
  return Boolean(
    process.env.SCRAPINGDOG_API_KEY?.trim() || process.env.SCRAPING_DOG_API_KEY?.trim()
  );
}

export function hasBrightDataCredentials(): boolean {
  return Boolean(process.env.BRIGHTDATA_API_KEY?.trim());
}

export function jitterMs(minMs: number, maxMs: number): number {
  const lo = Math.min(minMs, maxMs);
  const hi = Math.max(minMs, maxMs);
  if (hi <= 0) return 0;
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}
