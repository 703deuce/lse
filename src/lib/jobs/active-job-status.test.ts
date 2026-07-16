import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  applyPollJitter,
  isActiveJobStatus,
  isTerminalJobStatus,
  nextPollIntervalMs,
} from "@/lib/jobs/active-job-status";
import {
  assertJobStatusRateLimit,
  isJobHeartbeatStale,
  resetJobStatusRateLimitsForTests,
} from "@/lib/jobs/compact-job-status";

describe("active job polling policy", () => {
  it("stops on terminal ledger and feature statuses", () => {
    for (const s of [
      "completed",
      "complete",
      "failed",
      "canceled",
      "cancelled",
      "permanently_failed",
      "dead_letter",
    ]) {
      assert.equal(isTerminalJobStatus(s), true, s);
      assert.equal(isActiveJobStatus(s), false, s);
    }
    for (const s of ["pending_enqueue", "queued", "running", "retrying", "generating"]) {
      assert.equal(isTerminalJobStatus(s), false, s);
      assert.equal(isActiveJobStatus(s), true, s);
    }
  });

  it("uses adaptive intervals matching the launch schedule", () => {
    const t0 = 1_000_000;
    assert.ok(nextPollIntervalMs(t0, t0, t0 + 10_000) < 3000); // ~2s + jitter
    assert.ok(nextPollIntervalMs(t0, t0, t0 + 45_000) < 5500); // ~4s
    assert.ok(nextPollIntervalMs(t0, t0, t0 + 120_000) < 10_000); // ~8s
    assert.ok(nextPollIntervalMs(t0, t0, t0 + 400_000) >= 10_000); // ~15s
  });

  it("applies jitter without going below floor", () => {
    for (let i = 0; i < 20; i++) {
      assert.ok(applyPollJitter(2000) >= 500);
    }
  });

  it("rate-limits per org+job", () => {
    resetJobStatusRateLimitsForTests();
    assert.equal(assertJobStatusRateLimit({ organizationId: "o1", jobId: "j1" }).ok, true);
    assert.equal(assertJobStatusRateLimit({ organizationId: "o1", jobId: "j1" }).ok, true);
    const third = assertJobStatusRateLimit({ organizationId: "o1", jobId: "j1" });
    assert.equal(third.ok, false);
  });

  it("keeps polling on stalled wire status and detects stale heartbeats", () => {
    assert.equal(isActiveJobStatus("stalled"), true);
    assert.equal(isTerminalJobStatus("stalled"), false);
    const now = Date.now();
    assert.equal(
      isJobHeartbeatStale(
        {
          status: "running",
          heartbeat_at: new Date(now - 180_000).toISOString(),
        },
        now,
        120_000
      ),
      true
    );
    assert.equal(
      isJobHeartbeatStale(
        {
          status: "running",
          heartbeat_at: new Date(now - 30_000).toISOString(),
        },
        now,
        120_000
      ),
      false
    );
    assert.equal(
      isJobHeartbeatStale(
        { status: "completed", heartbeat_at: new Date(now - 180_000).toISOString() },
        now,
        120_000
      ),
      false
    );
  });
});
