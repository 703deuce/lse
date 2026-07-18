import { describe, it } from "node:test";
import assert from "node:assert/strict";

/**
 * Pure restore-patch rules mirrored from the account PATCH route.
 * Keeps §38 archive/restore coverage without spinning up Supabase.
 */
function restorePatch(input: {
  accountType?: "prospect" | "client" | null;
  currentType: "prospect" | "client" | null;
  currentTracked: boolean | null;
}): Record<string, unknown> {
  const patch: Record<string, unknown> = { archived_at: null };
  const nextType = input.accountType ?? input.currentType;
  if (nextType === "client" || (nextType == null && input.currentTracked !== false)) {
    patch.is_tracked = true;
    patch.account_type = "client";
    patch.prospect_status = null;
  } else {
    patch.is_tracked = false;
    if (input.accountType === undefined && nextType == null) {
      patch.account_type = "prospect";
    }
  }
  return patch;
}

describe("account restore patch", () => {
  it("restores archived clients as tracked", () => {
    const patch = restorePatch({
      currentType: "client",
      currentTracked: false,
    });
    assert.equal(patch.archived_at, null);
    assert.equal(patch.is_tracked, true);
    assert.equal(patch.account_type, "client");
    assert.equal(patch.prospect_status, null);
  });

  it("restores prospects without consuming a tracked slot", () => {
    const patch = restorePatch({
      currentType: "prospect",
      currentTracked: false,
    });
    assert.equal(patch.archived_at, null);
    assert.equal(patch.is_tracked, false);
  });
});
