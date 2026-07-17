import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mergeUnresolvedJobs, type GridCellJob } from "@/lib/jobs/run-grid-cells";

function job(pointId: string, keywordId = "kw1"): GridCellJob {
  return {
    scanBatchId: "scan-1",
    point: { id: pointId, grid_label: pointId, lat: 0, lng: 0 },
    keyword: { id: keywordId, keyword: "plumber" },
    business: {},
    device: "mobile",
    os: "android",
    browser: "chrome",
  };
}

describe("mergeUnresolvedJobs", () => {
  it("unions in-memory failures with DB incompletes (neither side can drop the other)", () => {
    const memory = [job("p1"), job("p2")];
    const db = [job("p2"), job("p3")];
    const merged = mergeUnresolvedJobs(memory, db);
    const ids = merged.map((j) => j.point.id).sort();
    assert.deepEqual(ids, ["p1", "p2", "p3"]);
  });

  it("keeps memory failures when DB read returns empty", () => {
    const memory = [job("p1"), job("p2")];
    const merged = mergeUnresolvedJobs(memory, []);
    assert.equal(merged.length, 2);
  });

  it("keeps DB incompletes when in-memory remaining was cleared", () => {
    const db = [job("p4"), job("p5")];
    const merged = mergeUnresolvedJobs([], db);
    assert.equal(merged.length, 2);
  });
});
