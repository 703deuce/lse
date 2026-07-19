import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_DFS_EXECUTION_MODE,
  dfsApiPriorityForMode,
  dfsMethodForMode,
  osForScanDevice,
  parseDfsExecutionMode,
} from "@/lib/maps/dfs-execution-modes";

describe("dfs-execution-modes", () => {
  it("defaults to priority", () => {
    assert.equal(DEFAULT_DFS_EXECUTION_MODE, "priority");
    assert.equal(parseDfsExecutionMode(undefined), "priority");
    assert.equal(parseDfsExecutionMode("nope"), "priority");
  });

  it("maps modes to API priority and method", () => {
    assert.equal(dfsApiPriorityForMode("priority"), 2);
    assert.equal(dfsApiPriorityForMode("standard"), 1);
    assert.equal(dfsApiPriorityForMode("live"), 2);
    assert.equal(dfsMethodForMode("live"), "dfs_live_advanced");
    assert.equal(dfsMethodForMode("priority"), "dfs_priority_batch");
    assert.equal(dfsMethodForMode("standard"), "dfs_priority_batch");
  });

  it("picks OS for device", () => {
    assert.equal(osForScanDevice("desktop"), "windows");
    assert.equal(osForScanDevice("mobile"), "android");
  });
});
