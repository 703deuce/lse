import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  hasTrailingCellsSettling,
  isGridPassStillSettling,
  isScanMapReady,
  shouldPollUntilMapReady,
} from "@/lib/scans/status";

describe("scan map ready / retry pin settle", () => {
  it("keeps polling while pass is retry or integrity even after soft-ready timestamps", () => {
    const batch = {
      status: "rank_ready",
      rank_ready_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      cells_completed: 9,
      cells_total: 9,
      confidence_summary: { pass: "retry-1" },
    };
    assert.equal(isGridPassStillSettling(batch), true);
    assert.equal(hasTrailingCellsSettling(batch), true);
    assert.equal(isScanMapReady(batch, 9, 9), false);
    assert.equal(shouldPollUntilMapReady(batch, 9, 9), true);
  });

  it("stops polling when pass is complete and all results loaded", () => {
    const batch = {
      status: "rank_ready",
      rank_ready_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      cells_completed: 9,
      cells_total: 9,
      confidence_summary: { pass: "complete" },
    };
    assert.equal(isGridPassStillSettling(batch), false);
    assert.equal(isScanMapReady(batch, 9, 9), true);
    assert.equal(shouldPollUntilMapReady(batch, 9, 9), false);
  });

  it("does not treat missing pass as still settling", () => {
    assert.equal(isGridPassStillSettling({ confidence_summary: {} }), false);
    assert.equal(isGridPassStillSettling({ confidence_summary: { pass: "complete" } }), false);
  });

  it("keeps wait UI up during secondary fallback even if rank_ready timestamps exist", () => {
    const batch = {
      status: "rank_ready",
      rank_ready_at: new Date().toISOString(),
      finished_at: new Date().toISOString(),
      cells_completed: 33,
      cells_total: 49,
      confidence_summary: {
        pass: "fallback-secondary",
        recovery_stage: "fallback_dataforseo",
      },
    };
    assert.equal(isScanMapReady(batch, 33, 49), false);
    assert.equal(shouldPollUntilMapReady(batch, 33, 49), true);
  });
});
