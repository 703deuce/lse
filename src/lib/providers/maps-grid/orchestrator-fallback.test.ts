import assert from "node:assert/strict";
import { describe, it, before, after } from "node:test";
import { fetchMapsCell } from "@/lib/providers/maps-grid/orchestrator";

describe("fetchMapsCell secondary attempt records", () => {
  const prev = {
    fallback: process.env.MAPS_GRID_FALLBACK_ENABLED,
    dfsEnabled: process.env.DATAFORSEO_MAPS_ENABLED,
    dfsUser: process.env.DATAFORSEO_USERNAME,
    dfsPass: process.env.DATAFORSEO_PASSWORD,
    sdEnabled: process.env.SCRAPINGDOG_MAPS_ENABLED,
    sdKey: process.env.SCRAPINGDOG_API_KEY,
    sdKey2: process.env.SCRAPING_DOG_API_KEY,
  };

  before(() => {
    process.env.MAPS_GRID_FALLBACK_ENABLED = "true";
    process.env.DATAFORSEO_MAPS_ENABLED = "true";
    process.env.SCRAPINGDOG_MAPS_ENABLED = "true";
    delete process.env.DATAFORSEO_USERNAME;
    delete process.env.DATAFORSEO_PASSWORD;
    delete process.env.SCRAPINGDOG_API_KEY;
    delete process.env.SCRAPING_DOG_API_KEY;
  });

  after(() => {
    for (const [k, v] of Object.entries(prev)) {
      const envKey =
        k === "fallback"
          ? "MAPS_GRID_FALLBACK_ENABLED"
          : k === "dfsEnabled"
            ? "DATAFORSEO_MAPS_ENABLED"
            : k === "dfsUser"
              ? "DATAFORSEO_USERNAME"
              : k === "dfsPass"
                ? "DATAFORSEO_PASSWORD"
                : k === "sdEnabled"
                  ? "SCRAPINGDOG_MAPS_ENABLED"
                  : k === "sdKey"
                    ? "SCRAPINGDOG_API_KEY"
                    : "SCRAPING_DOG_API_KEY";
      if (v == null) delete process.env[envKey];
      else process.env[envKey] = v;
    }
  });

  it("records ScrapingDog + DataForSEO attempts even when credentials are missing", async () => {
    const result = await fetchMapsCell({
      keyword: "plumber",
      lat: 30.27,
      lng: -97.74,
      device: "mobile",
      os: "android",
      browser: "chrome",
      depth: 20,
      providers: ["scrapingdog", "dataforseo"],
      gridLabel: "A1",
    });

    assert.equal(result.ok, false);
    assert.equal(result.attempts.length, 2);
    assert.deepEqual(
      result.attempts.map((a) => a.provider),
      ["scrapingdog", "dataforseo"]
    );
    assert.ok(result.attempts.every((a) => a.category === "provider_unavailable"));
  });
});

describe("secondaryFallbackProviders order", () => {
  it("tries ScrapingDog before DataForSEO after Bright Data", async () => {
    const { secondaryFallbackProviders } = await import("@/lib/providers/maps-grid/orchestrator");
    assert.deepEqual(secondaryFallbackProviders(), ["scrapingdog", "dataforseo"]);
  });
});
