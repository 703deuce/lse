/**
 * Maps grid multi-provider configuration.
 * All tunables live here as env-backed getters — no scattered magic numbers.
 *
 * Production Bright Data policy (defaults):
 * - Burst primary: up to 100 in-flight
 * - Unfinished-only retries: 10s → 20s → 1m → 1m → 3m → 2m → 3m
 * - Bright Data only (no ScrapingDog mix)
 * - Circuit: ≥30% transient failures over last 20 (min 10) → open
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

/**
 * Bright Data global in-flight concurrency for Maps cells (across workers).
 * Default 100 matches the historical fair-chunk / grid burst — not the cautious 12.
 */
export function brightDataGlobalConcurrency(): number {
  return envInt("BRIGHTDATA_GLOBAL_CONCURRENCY", 100, { min: 1, max: 250 });
}

/**
 * Optional lower cap for adaptive mid-scan throttle (circuit recovery ramps).
 * Primary pass uses mapsGridConcurrency (up to 100), not this.
 */
export function brightDataHealthyConcurrency(): number {
  return envInt("BRIGHTDATA_HEALTHY_CONCURRENCY", brightDataGlobalConcurrency(), {
    min: 1,
    max: 250,
  });
}

export function brightDataNormalCellTimeoutMs(): number {
  return envInt("BRIGHTDATA_NORMAL_CELL_TIMEOUT_MS", 45_000, { min: 5_000, max: 180_000 });
}

/** Rolling sample size for the Bright Data circuit (last N attempts). */
export function brightDataCircuitSampleSize(): number {
  return envInt("BRIGHTDATA_CIRCUIT_SAMPLE_SIZE", 20, { min: 5, max: 200 });
}

/** Open circuit when degradation % over the sample window reaches this. */
export function brightDataCircuitOpenThresholdPercent(): number {
  return envInt("BRIGHTDATA_CIRCUIT_OPEN_THRESHOLD_PERCENT", 30, { min: 1, max: 100 });
}

/** Require at least this many samples before opening the circuit. */
export function brightDataCircuitMinSamples(): number {
  return envInt("BRIGHTDATA_CIRCUIT_MIN_SAMPLES", 10, { min: 1, max: 200 });
}

/** @deprecated Prefer brightDataCircuitOpenThresholdPercent — kept for analyzePrimaryWave callers. */
export function brightDataDegradedThresholdPercent(): number {
  return envInt(
    "BRIGHTDATA_DEGRADED_THRESHOLD_PERCENT",
    brightDataCircuitOpenThresholdPercent(),
    { min: 1, max: 100 }
  );
}

/** @deprecated Prefer brightDataCircuitMinSamples. */
export function brightDataDegradedMinFailures(): number {
  return envInt("BRIGHTDATA_DEGRADED_MIN_FAILURES", brightDataCircuitMinSamples(), {
    min: 1,
    max: 500,
  });
}

/** Soft time prune for Redis window entries (sample-count is authoritative). */
export function brightDataDegradedWindowMs(): number {
  return envInt("BRIGHTDATA_DEGRADED_WINDOW_MS", 600_000, { min: 1_000, max: 3_600_000 });
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
  return envInt("BRIGHTDATA_PROBE_COUNT", 2, { min: 1, max: 10 });
}

export function brightDataProbeConcurrency(): number {
  return envInt("BRIGHTDATA_PROBE_CONCURRENCY", 1, { min: 1, max: 5 });
}

export function brightDataProbeSuccessMin(): number {
  return envInt("BRIGHTDATA_PROBE_SUCCESS_MIN", 2, { min: 1, max: 10 });
}

export function brightDataHalfOpenConcurrency(): number {
  return envInt("BRIGHTDATA_HALF_OPEN_CONCURRENCY", 4, { min: 1, max: 50 });
}

export function brightDataHalfOpenRampConcurrency(): number {
  return envInt("BRIGHTDATA_HALF_OPEN_RAMP_CONCURRENCY", 8, { min: 1, max: 100 });
}

/** Initial open duration when the circuit first trips. */
export function brightDataCircuitOpenBaseMs(): number {
  return envInt("BRIGHTDATA_CIRCUIT_OPEN_BASE_MS", 30_000, { min: 1_000, max: 600_000 });
}

/** Cap for escalated open periods (~5 minutes). */
export function brightDataCircuitOpenMaxMs(): number {
  return envInt("BRIGHTDATA_CIRCUIT_OPEN_MAX_MS", 300_000, { min: 5_000, max: 900_000 });
}

/**
 * Hard ceiling for the full Bright Data recovery window
 * (primary burst + 10s/20s/1m/1m/3m/2m/3m waits + cell work).
 */
export function brightDataRecoveryDeadlineMs(): number {
  return envInt("BRIGHTDATA_RECOVERY_DEADLINE_MS", 20 * 60_000, {
    min: 60_000,
    max: 45 * 60_000,
  });
}

/**
 * @deprecated Prefer brightDataRecoverySchedule() tiers.
 * Kept so older env knobs still parse in tests/ops.
 */
export function brightDataDelayedRetryDelayMs(): number {
  return envInt("BRIGHTDATA_DELAYED_RETRY_DELAY_MS", 30_000, { min: 0, max: 300_000 });
}

/** @deprecated Prefer brightDataRecoverySchedule() length. */
export function brightDataDelayedRetryRounds(): number {
  return envInt("BRIGHTDATA_DELAYED_RETRY_ROUNDS", 3, { min: 0, max: 8 });
}

export function brightDataCircuitLeaseMs(): number {
  return envInt("BRIGHTDATA_CIRCUIT_LEASE_MS", 600_000, { min: 10_000, max: 900_000 });
}

export function dataForSeoMapsEnabled(): boolean {
  return envBool("DATAFORSEO_MAPS_ENABLED", true);
}

export function dataForSeoMapsConcurrency(): number {
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

export type BrightDataRecoveryRound = {
  /** 1-based round id for logs / UI */
  round: number;
  delayMinMs: number;
  delayMaxMs: number;
  concurrency: number;
};

/**
 * Bright Data recovery after the burst primary (unfinished cells only):
 * 10s → 20s → 1m → 1m → 3m → 2m → 3m
 */
export function brightDataRecoverySchedule(): BrightDataRecoveryRound[] {
  const burst = 100;
  const round = (
    n: number,
    delayMs: number,
    minEnv: string,
    maxEnv: string,
    concEnv: string
  ): BrightDataRecoveryRound => ({
    round: n,
    delayMinMs: envInt(minEnv, delayMs, { min: 0, max: 900_000 }),
    delayMaxMs: envInt(maxEnv, delayMs, { min: 0, max: 900_000 }),
    concurrency: envInt(concEnv, burst, { min: 1, max: 250 }),
  });
  return [
    round(1, 10_000, "BRIGHTDATA_RETRY1_DELAY_MIN_MS", "BRIGHTDATA_RETRY1_DELAY_MAX_MS", "BRIGHTDATA_RETRY1_CONCURRENCY"),
    round(2, 20_000, "BRIGHTDATA_RETRY2_DELAY_MIN_MS", "BRIGHTDATA_RETRY2_DELAY_MAX_MS", "BRIGHTDATA_RETRY2_CONCURRENCY"),
    round(3, 60_000, "BRIGHTDATA_RETRY3_DELAY_MIN_MS", "BRIGHTDATA_RETRY3_DELAY_MAX_MS", "BRIGHTDATA_RETRY3_CONCURRENCY"),
    round(4, 60_000, "BRIGHTDATA_RETRY4_DELAY_MIN_MS", "BRIGHTDATA_RETRY4_DELAY_MAX_MS", "BRIGHTDATA_RETRY4_CONCURRENCY"),
    round(5, 180_000, "BRIGHTDATA_RETRY5_DELAY_MIN_MS", "BRIGHTDATA_RETRY5_DELAY_MAX_MS", "BRIGHTDATA_RETRY5_CONCURRENCY"),
    round(6, 120_000, "BRIGHTDATA_RETRY6_DELAY_MIN_MS", "BRIGHTDATA_RETRY6_DELAY_MAX_MS", "BRIGHTDATA_RETRY6_CONCURRENCY"),
    round(7, 180_000, "BRIGHTDATA_RETRY7_DELAY_MIN_MS", "BRIGHTDATA_RETRY7_DELAY_MAX_MS", "BRIGHTDATA_RETRY7_CONCURRENCY"),
  ];
}

/** Escalating open durations: 30s → 60s → 120s → 240s → max. */
export function brightDataCircuitOpenDurationMs(openStreak: number): number {
  const base = brightDataCircuitOpenBaseMs();
  const max = brightDataCircuitOpenMaxMs();
  const streak = Math.max(0, Math.floor(openStreak));
  const ms = base * 2 ** streak;
  return Math.min(max, ms);
}
