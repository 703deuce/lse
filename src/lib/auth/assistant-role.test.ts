import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { roleHasPermission, normalizeOrgRole } from "@/lib/auth/permissions-core";

describe("assistant role", () => {
  it("normalizes assistant", () => {
    assert.equal(normalizeOrgRole("assistant"), "assistant");
  });

  it("can run scans and share reports", () => {
    assert.equal(roleHasPermission("assistant", "scan.run"), true);
    assert.equal(roleHasPermission("assistant", "report.share"), true);
    assert.equal(roleHasPermission("assistant", "report.create"), true);
  });

  it("cannot invite, bill, or delete the org", () => {
    assert.equal(roleHasPermission("assistant", "member.invite"), false);
    assert.equal(roleHasPermission("assistant", "billing.read"), false);
    assert.equal(roleHasPermission("assistant", "org.delete"), false);
    assert.equal(roleHasPermission("assistant", "member.manage"), false);
  });
});
