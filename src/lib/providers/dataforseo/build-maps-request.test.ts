import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildMapsLiveRequest,
  formatMapsLocationCoordinate,
} from "@/lib/providers/dataforseo/build-maps-request";

describe("DataForSEO Maps location_coordinate", () => {
  it("formats zoom with z suffix per DataForSEO docs", () => {
    assert.equal(
      formatMapsLocationCoordinate(38.7354825480337, -77.4445995074144, 17),
      "38.7354825,-77.4445995,17z"
    );
  });

  it("buildMapsLiveRequest uses docs-shaped coordinate and maps live fields", () => {
    const req = buildMapsLiveRequest({
      keyword: "junk removal woodbridge",
      lat: 38.7354825480337,
      lng: -77.4445995074144,
      profile: { device: "mobile", os: "android", browser: "chrome" },
      depth: 20,
    });
    assert.equal(req.location_coordinate, "38.7354825,-77.4445995,13z");
    assert.equal(req._meta.zoom, 13);
    assert.equal(req.device, "mobile");
    assert.equal(req.os, "android");
    assert.equal(req.search_this_area, false);
    assert.equal(req.search_places, false);
    assert.equal(req.se_domain, "google.com");
    assert.equal(req._meta.endpoint, "serp/google/maps/live/advanced");
    const body = { ...req };
    delete (body as { _meta?: unknown })._meta;
    assert.equal("browser" in body, false);
  });
});
