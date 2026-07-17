import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { gridScanAutoEnrichmentEnabled } from "@/lib/jobs/grid-scan-enrichment-flag";

describe("gridScanAutoEnrichmentEnabled", () => {
  it("is off by default and only on for exact true", () => {
    const prev = process.env.GRID_SCAN_AUTO_ENRICHMENT;
    try {
      delete process.env.GRID_SCAN_AUTO_ENRICHMENT;
      assert.equal(gridScanAutoEnrichmentEnabled(), false);

      process.env.GRID_SCAN_AUTO_ENRICHMENT = "false";
      assert.equal(gridScanAutoEnrichmentEnabled(), false);

      process.env.GRID_SCAN_AUTO_ENRICHMENT = "1";
      assert.equal(gridScanAutoEnrichmentEnabled(), false);

      process.env.GRID_SCAN_AUTO_ENRICHMENT = "true";
      assert.equal(gridScanAutoEnrichmentEnabled(), true);
    } finally {
      if (prev == null) delete process.env.GRID_SCAN_AUTO_ENRICHMENT;
      else process.env.GRID_SCAN_AUTO_ENRICHMENT = prev;
    }
  });
});
