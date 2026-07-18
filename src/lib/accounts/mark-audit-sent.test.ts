import assert from "node:assert/strict";
import { describe, it } from "node:test";

/** Pure decision helper mirroring markProspectAuditSent eligibility. */
function shouldMarkAuditSent(input: {
  accountType: string | null;
  prospectStatus: string | null;
  archivedAt: string | null;
}): boolean {
  if (input.archivedAt) return false;
  if (input.accountType !== "prospect") return false;
  const status = input.prospectStatus;
  if (status && !["new", "contacted"].includes(status)) return false;
  return true;
}

describe("markProspectAuditSent eligibility", () => {
  it("advances new and contacted prospects", () => {
    assert.equal(
      shouldMarkAuditSent({ accountType: "prospect", prospectStatus: "new", archivedAt: null }),
      true
    );
    assert.equal(
      shouldMarkAuditSent({
        accountType: "prospect",
        prospectStatus: "contacted",
        archivedAt: null,
      }),
      true
    );
  });

  it("does not overwrite later pipeline stages or clients", () => {
    assert.equal(
      shouldMarkAuditSent({
        accountType: "prospect",
        prospectStatus: "proposal_sent",
        archivedAt: null,
      }),
      false
    );
    assert.equal(
      shouldMarkAuditSent({ accountType: "client", prospectStatus: null, archivedAt: null }),
      false
    );
    assert.equal(
      shouldMarkAuditSent({
        accountType: "prospect",
        prospectStatus: "new",
        archivedAt: "2026-01-01",
      }),
      false
    );
  });
});
