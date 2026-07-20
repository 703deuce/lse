import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { safeNextPath, safeNextPathOrNull } from "@/lib/auth/safe-next";

describe("safeNextPath", () => {
  it("allows relative app paths", () => {
    assert.equal(safeNextPath("/workspace"), "/workspace");
    assert.equal(safeNextPath("/clients/abc"), "/clients/abc");
  });

  it("rejects open redirects", () => {
    assert.equal(safeNextPath("//evil.com"), "/workspace");
    assert.equal(safeNextPath("https://evil.com"), "/workspace");
    assert.equal(safeNextPath("/\\evil"), "/workspace");
    assert.equal(safeNextPathOrNull("//evil.com"), null);
  });
});
