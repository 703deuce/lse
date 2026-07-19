import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MAPS_LOCATION_ZOOM,
  MAPS_ZOOM_OPTIONS,
  parseMapsLocationZoom,
} from "@/lib/maps/maps-zoom";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { DEFAULT_SCAN_PROFILE } from "@/lib/maps/scan-profiles";
import { formatMapsLocationCoordinate } from "@/lib/providers/dataforseo/build-maps-request";

describe("Maps location zoom (Local Falcon parity recipe)", () => {
  it("defaults to zoom 14 + desktop/windows Falcon recipe", () => {
    assert.equal(DEFAULT_MAPS_LOCATION_ZOOM, 14);
    assert.equal(LOCAL_FALCON_PARITY.locationZoom, 14);
    assert.equal(LOCAL_FALCON_PARITY.searchThisArea, false);
    assert.equal(LOCAL_FALCON_PARITY.searchPlaces, true);
    assert.equal(DEFAULT_SCAN_PROFILE.device, "desktop");
    assert.equal(DEFAULT_SCAN_PROFILE.os, "windows");
    assert.deepEqual(MAPS_ZOOM_OPTIONS, [13, 14, 15, 16, 17]);
  });

  it("parses and clamps zoom", () => {
    assert.equal(parseMapsLocationZoom(undefined), 14);
    assert.equal(parseMapsLocationZoom(15), 15);
    assert.equal(parseMapsLocationZoom("17"), 17);
    assert.equal(parseMapsLocationZoom(99), 18);
    assert.equal(parseMapsLocationZoom(-1), 0);
  });

  it("formats DataForSEO location_coordinate with chosen zoom", () => {
    assert.equal(
      formatMapsLocationCoordinate(27.9506, -82.4572, 14),
      "27.9506,-82.4572,14z"
    );
  });
});
