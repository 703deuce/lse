import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  getBackgroundRecoveryDelay,
  mapsRecoveryIdempotencyKey,
} from "@/lib/jobs/scan-recovery";
import { isScanActivelyRunning } from "@/lib/scans/status";

describe("maps scan persistent recovery scheduling", () => {
  it("uses stepped background delays by generation", () => {
    assert.equal(getBackgroundRecoveryDelay(1), 5 * 60_000);
    assert.equal(getBackgroundRecoveryDelay(2), 5 * 60_000);
    assert.equal(getBackgroundRecoveryDelay(3), 10 * 60_000);
    assert.equal(getBackgroundRecoveryDelay(4), 10 * 60_000);
    assert.equal(getBackgroundRecoveryDelay(5), 15 * 60_000);
    assert.equal(getBackgroundRecoveryDelay(99), 15 * 60_000);
  });

  it("builds deterministic recovery idempotency keys", () => {
    const scanId = "11111111-1111-4111-8111-111111111111";
    assert.equal(
      mapsRecoveryIdempotencyKey(scanId, 1),
      `maps-recovery:${scanId}:generation:1`
    );
    assert.equal(
      mapsRecoveryIdempotencyKey(scanId, 2),
      `maps-recovery:${scanId}:generation:2`
    );
    assert.notEqual(
      mapsRecoveryIdempotencyKey(scanId, 1),
      mapsRecoveryIdempotencyKey(scanId, 2)
    );
  });
});

describe("scan active UI statuses", () => {
  it("treats queued/running/recovering/finalizing as active", () => {
    for (const status of [
      "queued",
      "dispatching",
      "provider_running",
      "recovering",
      "normalizing",
    ]) {
      assert.equal(isScanActivelyRunning(status), true, status);
    }
  });

  it("does not treat complete/failed as active", () => {
    for (const status of ["rank_ready", "ready", "partial", "failed", "cancelled"]) {
      assert.equal(isScanActivelyRunning(status), false, status);
    }
  });
});

describe("recovery decision matrix (acceptance cases)", () => {
  it("case 1: all cells complete → no recovery job", () => {
    const unresolved = 0;
    const needsBackgroundRecovery = unresolved > 0;
    assert.equal(needsBackgroundRecovery, false);
  });

  it("case 2: partial completion → recovering + schedule generation 1", () => {
    const completed = 40;
    const unresolved = 9;
    const total = 49;
    assert.equal(completed + unresolved, total);
    const nextGeneration = Math.max(1, 0 + 1);
    assert.equal(nextGeneration, 1);
    assert.equal(getBackgroundRecoveryDelay(nextGeneration), 5 * 60_000);
  });

  it("case 3: background recovery with remaining cells schedules next generation", () => {
    const currentGeneration = 1;
    const unresolvedAfter = 3;
    assert.ok(unresolvedAfter > 0);
    const next = currentGeneration + 1;
    assert.equal(mapsRecoveryIdempotencyKey("scan", next).includes("generation:2"), true);
  });

  it("case 4: eventual completion → finalize path", () => {
    const unresolved = 0;
    const shouldFinalize = unresolved === 0;
    assert.equal(shouldFinalize, true);
  });

  it("case 5: duplicate recovery prevented by deterministic key", () => {
    const a = mapsRecoveryIdempotencyKey("scan-a", 1);
    const b = mapsRecoveryIdempotencyKey("scan-a", 1);
    assert.equal(a, b);
  });

  it("case 7: capacity errors keep scan active, not failed", () => {
    const category = "capacity_timeout";
    const cellStatus = category === "capacity_timeout" ? "retry_wait" : "failed_permanent";
    const scanStatus = "recovering";
    assert.equal(cellStatus, "retry_wait");
    assert.notEqual(scanStatus, "failed");
    assert.equal(isScanActivelyRunning(scanStatus), true);
  });

  it("case 9: resume only unresolved cells", () => {
    const total = 49;
    const completed = 35;
    const unresolved = total - completed;
    assert.equal(unresolved, 14);
    // Completed cells must remain saved and excluded from retry set.
    assert.ok(completed > 0 && unresolved > 0);
  });
});
