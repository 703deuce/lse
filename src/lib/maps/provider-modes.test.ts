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
  it("defaults unknown values to DataForSEO", () => {
    assert.equal(DEFAULT_MAPS_PROVIDER_MODE, "dataforseo");
    assert.equal(parseMapsProviderMode(undefined), "dataforseo");
    assert.equal(parseMapsProviderMode("nope"), "dataforseo");
    assert.equal(parseMapsProviderMode("hybrid"), "hybrid");
    assert.equal(parseMapsProviderMode("scrapingdog"), "scrapingdog");
  });

  it("hybrid is Bright Data alternate", () => {
    assert.deepEqual(primaryProvidersForMode("hybrid"), ["brightdata"]);
    assert.deepEqual(secondaryProvidersForMode("hybrid"), []);
    assert.deepEqual(integrityProvidersForMode("hybrid"), ["brightdata"]);
    assert.equal(scanBatchProviderColumn("hybrid"), "brightdata");
  });

  it("scrapingdog mode is pure A/B (no secondary chain)", () => {
    assert.deepEqual(primaryProvidersForMode("scrapingdog"), ["scrapingdog"]);
    assert.deepEqual(secondaryProvidersForMode("scrapingdog"), []);
    assert.deepEqual(integrityProvidersForMode("scrapingdog"), ["scrapingdog"]);
    assert.equal(scanBatchProviderColumn("scrapingdog"), "scrapingdog");
  });

  it("dataforseo is production default with no secondary fallback", () => {
    assert.deepEqual(primaryProvidersForMode("dataforseo"), ["dataforseo"]);
    assert.deepEqual(secondaryProvidersForMode("dataforseo"), []);
    assert.deepEqual(integrityProvidersForMode("dataforseo"), ["dataforseo"]);
    assert.equal(scanBatchProviderColumn("dataforseo"), "dataforseo");
  });
});
