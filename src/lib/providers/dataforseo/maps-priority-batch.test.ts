import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  DATAFORSEO_MAPS_PRIORITY_HIGH,
  MAPS_TASK_POST_ENDPOINT,
} from "@/lib/providers/dataforseo/maps-priority-batch";
import { buildMapsLiveRequest, mapsLiveRequestBody } from "@/lib/providers/dataforseo/build-maps-request";

describe("DataForSEO Maps Priority batch shape", () => {
  it("uses high priority and Local Falcon STA request body", () => {
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
      tag: "point:keyword",
    };

    assert.equal(body.priority, 2);
    assert.equal(body.search_this_area, true);
    assert.equal(body.depth, 20);
    assert.equal(body.device, "mobile");
    assert.match(body.location_coordinate, /17z$/);
    assert.equal(body.tag, "point:keyword");
  });
});
