import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
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

describe("full pack required before 20+", () => {
  it("requires depth (20) results before not-found is complete", () => {
    assert.equal(minResultsForNotFound(20), 20);
    const sparse = validateLiveCellSerp(fakeItems(3), target, 20);
    assert.equal(sparse.complete, false);
    assert.match(String(sparse.reason), /incomplete SERP for 20\+/i);
  });

  it("accepts not-found only when a full top-20 pack returned", () => {
    const full = validateLiveCellSerp(fakeItems(20), target, 20);
    assert.equal(full.complete, true);
  });

  it("accepts found ranks even with a shorter-but-valid pack (>=3)", () => {
    const found = validateLiveCellSerp(fakeItems(5, 2), target, 20);
    assert.equal(found.complete, true);
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

  it("stored not-found with 20 competitors is complete", () => {
    const stored = validateStoredCellResult(
      {
        target_found: false,
        target_rank: null,
        top_competitors_json: Array.from({ length: 20 }, () => ({})),
      },
      20
    );
    assert.equal(stored.complete, true);
  });
});
