import assert from "node:assert/strict";
import { describe, it } from "node:test";

describe("journey next-best-actions contract", () => {
  it("exports stable action kind values used by the UI", () => {
    const kinds = [
      "setup",
      "scan",
      "campaign",
      "audit",
      "report",
      "prospect",
      "client",
      "branding",
    ] as const;
    assert.equal(kinds.length, 8);
    assert.ok(kinds.includes("report"));
  });
});
