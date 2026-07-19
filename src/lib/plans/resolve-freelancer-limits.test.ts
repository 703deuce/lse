import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { resolveFreelancerLimits } from "@/lib/plans/resolve-freelancer-limits";

describe("resolveFreelancerLimits", () => {
  it("keeps starter at one concurrent scan", () => {
    const limits = resolveFreelancerLimits("starter");
    assert.equal(limits.maxConcurrentScans, 1);
    assert.equal(limits.maxGridSize, 9);
  });

  it("gives internal the highest concurrent scan capacity", () => {
    const limits = resolveFreelancerLimits("internal");
    assert.equal(limits.maxConcurrentScans, 25);
    assert.equal(limits.maxActiveLocations, 9999);
    assert.equal(limits.maxGridSize, 13);
    assert.ok(limits.allowedScheduleFrequencies.includes("weekly"));
  });

  it("keeps paid tiers at one concurrent scan (serial per org)", () => {
    const agency = resolveFreelancerLimits("agency");
    const pro = resolveFreelancerLimits("pro");
    assert.equal(pro.maxConcurrentScans, 1);
    assert.equal(agency.maxConcurrentScans, 1);
    assert.ok(agency.maxActiveLocations > pro.maxActiveLocations);
  });
});
