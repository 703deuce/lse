import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import {
  brightDataCircuitOpenDurationMs,
  brightDataGlobalConcurrency,
  brightDataHealthyConcurrency,
  brightDataRecoveryDeadlineMs,
  brightDataRecoverySchedule,
} from "@/lib/providers/maps-grid/config";
import {
  adaptiveBrightDataConcurrency,
  recoveryRoundConcurrency,
  recoveryRoundDelayMs,
} from "@/lib/providers/maps-grid/batch-recovery";

describe("Bright Data burst + backoff recovery config", () => {
  const keys = [
    "BRIGHTDATA_GLOBAL_CONCURRENCY",
    "BRIGHTDATA_HEALTHY_CONCURRENCY",
    "BRIGHTDATA_RECOVERY_DEADLINE_MS",
    "BRIGHTDATA_RETRY1_DELAY_MIN_MS",
    "BRIGHTDATA_RETRY1_DELAY_MAX_MS",
    "BRIGHTDATA_RETRY1_CONCURRENCY",
    "BRIGHTDATA_RETRY2_DELAY_MIN_MS",
    "BRIGHTDATA_RETRY2_DELAY_MAX_MS",
    "BRIGHTDATA_RETRY2_CONCURRENCY",
    "BRIGHTDATA_RETRY3_DELAY_MIN_MS",
    "BRIGHTDATA_RETRY3_DELAY_MAX_MS",
    "BRIGHTDATA_RETRY3_CONCURRENCY",
    "BRIGHTDATA_RETRY4_DELAY_MIN_MS",
    "BRIGHTDATA_RETRY4_DELAY_MAX_MS",
    "BRIGHTDATA_RETRY4_CONCURRENCY",
    "BRIGHTDATA_RETRY5_DELAY_MIN_MS",
    "BRIGHTDATA_RETRY5_DELAY_MAX_MS",
    "BRIGHTDATA_RETRY5_CONCURRENCY",
    "BRIGHTDATA_RETRY6_DELAY_MIN_MS",
    "BRIGHTDATA_RETRY6_DELAY_MAX_MS",
    "BRIGHTDATA_RETRY6_CONCURRENCY",
    "BRIGHTDATA_RETRY7_DELAY_MIN_MS",
    "BRIGHTDATA_RETRY7_DELAY_MAX_MS",
    "BRIGHTDATA_RETRY7_CONCURRENCY",
    "BRIGHTDATA_CIRCUIT_OPEN_BASE_MS",
    "BRIGHTDATA_CIRCUIT_OPEN_MAX_MS",
  ];
  const prev: Record<string, string | undefined> = {};

  before(() => {
    for (const k of keys) {
      prev[k] = process.env[k];
      delete process.env[k];
    }
  });

  after(() => {
    for (const k of keys) {
      if (prev[k] == null) delete process.env[k];
      else process.env[k] = prev[k];
    }
  });

  it("defaults global concurrency to 100 (burst)", () => {
    assert.equal(brightDataGlobalConcurrency(), 100);
    assert.equal(brightDataHealthyConcurrency(), 100);
  });

  it("recovery waits: 10s → 20s → 1m → 1m → 3m → 2m → 3m on unfinished only", () => {
    const schedule = brightDataRecoverySchedule();
    assert.equal(schedule.length, 7);
    assert.deepEqual(
      schedule.map((r) => [r.delayMinMs, r.delayMaxMs, r.concurrency]),
      [
        [10_000, 10_000, 100],
        [20_000, 20_000, 100],
        [60_000, 60_000, 100],
        [60_000, 60_000, 100],
        [180_000, 180_000, 100],
        [120_000, 120_000, 100],
        [180_000, 180_000, 100],
      ]
    );
    assert.equal(recoveryRoundDelayMs(schedule[0]), 10_000);
    assert.equal(recoveryRoundDelayMs(schedule[4]), 180_000);
    assert.equal(recoveryRoundConcurrency(schedule[0], 11), 11);
    assert.equal(brightDataRecoveryDeadlineMs(), 20 * 60_000);
  });

  it("circuit open durations escalate 30s → 60s → 120s → 240s → 300s cap", () => {
    assert.equal(brightDataCircuitOpenDurationMs(0), 30_000);
    assert.equal(brightDataCircuitOpenDurationMs(1), 60_000);
    assert.equal(brightDataCircuitOpenDurationMs(2), 120_000);
    assert.equal(brightDataCircuitOpenDurationMs(3), 240_000);
    assert.equal(brightDataCircuitOpenDurationMs(4), 300_000);
    assert.equal(brightDataCircuitOpenDurationMs(8), 300_000);
  });

  it("adaptive concurrency steps down with success rate", () => {
    assert.equal(adaptiveBrightDataConcurrency(0.99), 100);
    assert.equal(adaptiveBrightDataConcurrency(0.9), 8);
    assert.equal(adaptiveBrightDataConcurrency(0.75), 4);
    assert.equal(adaptiveBrightDataConcurrency(0.5), 2);
  });
});
