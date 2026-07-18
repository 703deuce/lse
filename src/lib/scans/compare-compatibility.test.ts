import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { assessScanCompareCompatibility } from "@/lib/scans/compare-compatibility";

describe("assessScanCompareCompatibility", () => {
  it("marks matching scans compatible", () => {
    const result = assessScanCompareCompatibility(
      {
        keyword: "plumber",
        gridSize: 7,
        radiusMeters: 3000,
        centerLat: 38.1,
        centerLng: -77.2,
        businessId: "a",
      },
      {
        keyword: "plumber",
        gridSize: 7,
        radiusMeters: 3000,
        centerLat: 38.1,
        centerLng: -77.2,
        businessId: "a",
      }
    );
    assert.equal(result.compatible, true);
    assert.equal(result.warnings.length, 0);
  });

  it("warns on incompatible axes", () => {
    const result = assessScanCompareCompatibility(
      {
        keyword: "plumber",
        gridSize: 5,
        radiusMeters: 3000,
        centerLat: 38.1,
        centerLng: -77.2,
        businessId: "a",
      },
      {
        keyword: "emergency plumber",
        gridSize: 9,
        radiusMeters: 5000,
        centerLat: 38.2,
        centerLng: -77.3,
        businessId: "b",
      }
    );
    assert.equal(result.compatible, false);
    assert.ok(result.warnings.some((w) => /keyword/i.test(w)));
    assert.ok(result.warnings.some((w) => /grid/i.test(w)));
    assert.ok(result.warnings.some((w) => /radius/i.test(w)));
    assert.ok(result.warnings.some((w) => /center/i.test(w)));
    assert.ok(result.warnings.some((w) => /business/i.test(w)));
  });
});
