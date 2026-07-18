import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { sanitizeScanBatchForClient } from "@/lib/scans/sanitize-scan-batch-for-client";

describe("sanitizeScanBatchForClient", () => {
  it("strips provider credentials and renames provider", () => {
    const safe = sanitizeScanBatchForClient({
      id: "1",
      provider: "brightdata",
      error_message: "Bright Data API key invalid for zone serp_api1",
      confidence_summary: {
        keyword_ids: ["k1"],
        provider_error: "check BRIGHTDATA_API_KEY",
        provider: "brightdata",
        maps_provider_mode: "hybrid",
        completed_cells: 3,
      },
    });
    assert.equal(safe.provider, "maps");
    assert.ok(
      typeof safe.error_message === "string" &&
        !/bright\s*data|api key|serp_api/i.test(safe.error_message)
    );
    const conf = safe.confidence_summary as Record<string, unknown>;
    assert.equal(conf.provider_error, undefined);
    assert.equal(conf.provider, undefined);
    assert.equal(conf.maps_provider_mode, undefined);
    assert.deepEqual(conf.keyword_ids, ["k1"]);
    assert.equal(conf.completed_cells, 3);
  });
});
