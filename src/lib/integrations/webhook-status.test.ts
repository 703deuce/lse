import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapEnrollmentSkipStatus } from "./webhook-status";

describe("mapEnrollmentSkipStatus", () => {
  it("maps opt-out and recent contact reasons case-insensitively", () => {
    assert.equal(mapEnrollmentSkipStatus("Opted out (SMS)"), "ignored_suppressed");
    assert.equal(mapEnrollmentSkipStatus("Contacted in last 90 days (phone)"), "ignored_recently_requested");
    assert.equal(mapEnrollmentSkipStatus("Already enrolled"), "ignored_duplicate");
  });
});
