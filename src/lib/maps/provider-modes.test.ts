import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MAPS_PROVIDER_MODE,
  integrityProvidersForMode,
  parseMapsProviderMode,
  primaryProvidersForMode,
  scanBatchProviderColumn,
  secondaryProvidersForMode,
} from "@/lib/maps/provider-modes";

describe("maps provider modes", () => {
  it("defaults unknown values to hybrid", () => {
    assert.equal(parseMapsProviderMode(undefined), DEFAULT_MAPS_PROVIDER_MODE);
    assert.equal(parseMapsProviderMode("nope"), "hybrid");
    assert.equal(parseMapsProviderMode("dataforseo"), "dataforseo");
  });

  it("hybrid is Bright Data only with delayed retries (no DFS/SD switch)", () => {
    assert.deepEqual(primaryProvidersForMode("hybrid"), ["brightdata"]);
    assert.deepEqual(secondaryProvidersForMode("hybrid"), []);
    assert.deepEqual(integrityProvidersForMode("hybrid"), ["brightdata"]);
    assert.equal(scanBatchProviderColumn("hybrid"), "brightdata");
  });

  it("scrapingdog mode is single-provider with no secondary chain", () => {
    assert.deepEqual(primaryProvidersForMode("scrapingdog"), ["scrapingdog"]);
    assert.deepEqual(secondaryProvidersForMode("scrapingdog"), []);
    assert.deepEqual(integrityProvidersForMode("scrapingdog"), ["scrapingdog"]);
    assert.equal(scanBatchProviderColumn("scrapingdog"), "scrapingdog");
  });

  it("dataforseo mode is single-provider with no secondary chain", () => {
    assert.deepEqual(primaryProvidersForMode("dataforseo"), ["dataforseo"]);
    assert.deepEqual(secondaryProvidersForMode("dataforseo"), []);
    assert.deepEqual(integrityProvidersForMode("dataforseo"), ["dataforseo"]);
    assert.equal(scanBatchProviderColumn("dataforseo"), "dataforseo");
  });
});
