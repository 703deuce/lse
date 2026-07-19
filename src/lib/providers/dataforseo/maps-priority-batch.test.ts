import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DATAFORSEO_MAPS_PRIORITY_HIGH,
  MAPS_TASK_POST_ENDPOINT,
  sanitizeMapsTaskTag,
  normalizeMapsSerpItems,
} from "@/lib/providers/dataforseo/maps-priority-batch";
import { buildMapsLiveRequest, mapsLiveRequestBody } from "@/lib/providers/dataforseo/build-maps-request";
import type { MapsLiveResult } from "@/lib/providers/dataforseo/index";

describe("DataForSEO Maps Priority batch shape", () => {
  it("uses high priority, STA on, search_places off for local-intent grids", () => {
    assert.equal(DATAFORSEO_MAPS_PRIORITY_HIGH, 2);
    assert.equal(MAPS_TASK_POST_ENDPOINT, "serp/google/maps/task_post");

    const request = buildMapsLiveRequest({
      keyword: "plumber near me",
      lat: 38.7354825,
      lng: -77.4445995,
      profile: { device: "mobile", os: "android", browser: "chrome" },
      depth: 20,
      searchThisArea: true,
    });
    const body = {
      ...mapsLiveRequestBody(request),
      priority: DATAFORSEO_MAPS_PRIORITY_HIGH,
      tag: sanitizeMapsTaskTag("point:keyword"),
    };

    assert.equal(body.priority, 2);
    assert.equal(body.search_this_area, true);
    assert.equal(body.search_places, false);
    assert.equal(body.depth, 20);
    assert.equal(body.device, "mobile");
    assert.match(body.location_coordinate, /17z$/);
    assert.equal(body.tag, "point_keyword");
  });

  it("sanitizes tags and keeps maps_search items", () => {
    assert.equal(sanitizeMapsTaskTag("a:b:c"), "a_b_c");
    const items = [
      { type: "refinement_chips", title: "x" },
      { type: "maps_search", title: "Acme", rank_absolute: 1 },
      { type: "maps_search", title: "Other", rank_absolute: 2 },
    ] as MapsLiveResult[];
    assert.equal(normalizeMapsSerpItems(items).length, 2);
  });
});
