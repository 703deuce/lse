import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareEntityGrids, rankDelta } from "@/lib/maps/grid-entity";

describe("compareEntityGrids deltas vs baseline", () => {
  it("treats scan A as baseline and B as current for SoLV/rank deltas", () => {
    const points = [
      { id: "p1", grid_label: "A1", lat: 30, lng: -90 },
      { id: "p2", grid_label: "A2", lat: 30.01, lng: -90 },
      { id: "p3", grid_label: "B1", lat: 30, lng: -89.99 },
    ];
    // Baseline: two top-3 cells
    const resultsA = [
      { scan_point_id: "p1", target_rank: 1, target_found: true },
      { scan_point_id: "p2", target_rank: 2, target_found: true },
      { scan_point_id: "p3", target_rank: 10, target_found: true },
    ];
    // Current: weaker (one top-3, worse ranks)
    const resultsB = [
      { scan_point_id: "p1", target_rank: 1, target_found: true },
      { scan_point_id: "p2", target_rank: 5, target_found: true },
      { scan_point_id: "p3", target_rank: 12, target_found: true },
    ];
    const you = { key: "you", label: "You", isTarget: true as const };

    const { summary } = compareEntityGrids(points, resultsA, points, resultsB, you, you);

    assert.ok(summary.solvA > summary.solvB);
    assert.ok(summary.solvDelta < 0, "SoLV drop should be negative vs baseline");
    assert.ok(
      summary.avgRankDelta != null && summary.avgRankDelta < 0,
      "worse (higher) avg rank should be negative delta"
    );
    assert.equal(rankDelta(2, 5), -3);
    assert.equal(rankDelta(10, 5), 5);
  });
});
