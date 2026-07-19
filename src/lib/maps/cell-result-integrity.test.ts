import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MIN_CELL_SERP_RESULTS,
  minCellSerpResults,
  minResultsForNotFound,
  validateLiveCellSerp,
  validateStoredCellResult,
} from "@/lib/maps/cell-result-integrity";
import type { MapsLiveResult } from "@/lib/providers/dataforseo";

function fakeItems(n: number, includeTargetAt?: number): MapsLiveResult[] {
  const items: MapsLiveResult[] = [];
  for (let i = 1; i <= n; i++) {
    const isTarget = includeTargetAt === i;
    items.push({
      title: isTarget ? "Acme Plumbing" : `Competitor ${i}`,
      place_id: isTarget ? "place-acme" : `place-${i}`,
      cid: isTarget ? "cid-acme" : `cid-${i}`,
      address: isTarget ? "1 Main St" : `${i} Other St`,
      rank_absolute: i,
    } as MapsLiveResult);
  }
  return items;
}

const target = {
  name: "Acme Plumbing",
  place_id: "place-acme",
  cid: "cid-acme",
  address: "1 Main St",
};

describe("min SERP floor (default 10)", () => {
  it("defaults to 10, not full depth 20", () => {
    assert.equal(DEFAULT_MIN_CELL_SERP_RESULTS, 10);
    assert.equal(minCellSerpResults(20), 10);
    assert.equal(minResultsForNotFound(20), 10);
  });

  it("rejects packs below 10 before not-found is complete", () => {
    const sparse = validateLiveCellSerp(fakeItems(3), target, 20);
    assert.equal(sparse.complete, false);
    assert.match(String(sparse.reason), /incomplete SERP for 20\+/i);
  });

  it("accepts not-found at 10+ results (even if under request depth)", () => {
    const ten = validateLiveCellSerp(fakeItems(10), target, 20);
    assert.equal(ten.complete, true);
    const nineteen = validateLiveCellSerp(fakeItems(19), target, 20);
    assert.equal(nineteen.complete, true);
  });

  it("rejects found ranks when pack is under 10", () => {
    const found = validateLiveCellSerp(fakeItems(5, 2), target, 20);
    assert.equal(found.complete, false);
    assert.match(String(found.reason), /sparse SERP/i);
  });

  it("accepts found ranks at 10+ (e.g. 19 of 20)", () => {
    const found10 = validateLiveCellSerp(fakeItems(10, 2), target, 20);
    assert.equal(found10.complete, true);
    const found19 = validateLiveCellSerp(fakeItems(19, 2), target, 20);
    assert.equal(found19.complete, true);
  });

  it("rejects target-only SERPs", () => {
    const only = validateLiveCellSerp(fakeItems(1, 1), target, 20);
    assert.equal(only.complete, false);
    assert.match(String(only.reason), /target-only/i);
  });

  it("stored not-found with 3 competitors is incomplete", () => {
    const stored = validateStoredCellResult(
      {
        target_found: false,
        target_rank: null,
        top_competitors_json: [{}, {}, {}],
      },
      20
    );
    assert.equal(stored.complete, false);
    assert.match(String(stored.reason), /incomplete stored SERP for 20\+/i);
  });

  it("stored not-found with 10 competitors is complete", () => {
    const stored = validateStoredCellResult(
      {
        target_found: false,
        target_rank: null,
        top_competitors_json: Array.from({ length: 10 }, () => ({})),
      },
      20
    );
    assert.equal(stored.complete, true);
  });
});
