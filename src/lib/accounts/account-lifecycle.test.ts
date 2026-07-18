import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { isClientRow, isProspectRow, type AccountListRow } from "@/lib/accounts/types";

describe("account list classification", () => {
  it("treats account_type prospect as prospect", () => {
    const row: AccountListRow = {
      id: "1",
      name: "Prospect Co",
      account_type: "prospect",
      is_tracked: false,
    };
    assert.equal(isProspectRow(row), true);
    assert.equal(isClientRow(row), false);
  });

  it("treats account_type client as client", () => {
    const row: AccountListRow = {
      id: "2",
      name: "Client Co",
      account_type: "client",
      is_tracked: true,
    };
    assert.equal(isClientRow(row), true);
    assert.equal(isProspectRow(row), false);
  });

  it("hides archived from active lists", () => {
    const row: AccountListRow = {
      id: "3",
      name: "Old Co",
      account_type: "client",
      is_tracked: false,
      archived_at: "2026-01-01T00:00:00Z",
    };
    assert.equal(isClientRow(row), false);
    assert.equal(isProspectRow(row), false);
  });

  it("falls back to is_tracked before migration", () => {
    const prospect: AccountListRow = { id: "4", name: "P", is_tracked: false };
    const client: AccountListRow = { id: "5", name: "C", is_tracked: true };
    assert.equal(isProspectRow(prospect), true);
    assert.equal(isClientRow(client), true);
  });
});
