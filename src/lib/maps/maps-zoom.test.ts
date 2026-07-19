import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DEFAULT_MAPS_LOCATION_ZOOM,
  MAPS_ZOOM_OPTIONS,
  parseMapsLocationZoom,
} from "@/lib/maps/maps-zoom";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { formatMapsLocationCoordinate } from "@/lib/providers/dataforseo/build-maps-request";

describe("Maps location zoom (Local Falcon parity)", () => {
  it("defaults to Local Falcon API zoom 13", () => {
    assert.equal(DEFAULT_MAPS_LOCATION_ZOOM, 13);
    assert.equal(LOCAL_FALCON_PARITY.locationZoom, 13);
    assert.deepEqual(MAPS_ZOOM_OPTIONS, [13, 14, 15, 16, 17]);
  });

  it("parses and clamps zoom", () => {
    assert.equal(parseMapsLocationZoom(undefined), 13);
    assert.equal(parseMapsLocationZoom(15), 15);
    assert.equal(parseMapsLocationZoom("17"), 17);
    assert.equal(parseMapsLocationZoom(99), 18);
    assert.equal(parseMapsLocationZoom(-1), 0);
  });

  it("formats DataForSEO location_coordinate with chosen zoom", () => {
    assert.equal(
      formatMapsLocationCoordinate(27.9506, -82.4572, 13),
      "27.9506,-82.4572,13z"
    );
    assert.equal(
      formatMapsLocationCoordinate(27.9506, -82.4572, 17),
      "27.9506,-82.4572,17z"
    );
  });
});
