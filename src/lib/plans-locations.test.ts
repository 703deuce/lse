import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { PLAN_DEFINITIONS } from "@/lib/plans";

describe("multi-location plan slots", () => {
  it("tiers allow 5 / 10 / 20 locations (internal unlimited)", () => {
    assert.equal(PLAN_DEFINITIONS.starter.limits.max_businesses, 5);
    assert.equal(PLAN_DEFINITIONS.pro.limits.max_businesses, 10);
    assert.equal(PLAN_DEFINITIONS.agency.limits.max_businesses, 20);
    assert.ok(PLAN_DEFINITIONS.internal.limits.max_businesses >= 1000);
  });
});
