import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shareIdentityKey } from "@/lib/reporting/share-export";

describe("shareIdentityKey", () => {
  it("is stable for single scan and competitor selections", () => {
    assert.equal(
      shareIdentityKey({ reportType: "single_scan", scanBatchId: "batch-1" }),
      "single_scan:batch-1"
    );
    assert.equal(
      shareIdentityKey({
        reportType: "competitor",
        scanBatchId: "batch-1",
        selectedCompetitorKeys: ["b", "a"],
      }),
      "competitor:batch-1:a,b"
    );
  });

  it("scopes maps campaign shares by campaign id", () => {
    assert.equal(
      shareIdentityKey({ reportType: "maps_campaign", campaignId: "camp-1" }),
      "maps_campaign:camp-1"
    );
    assert.equal(
      shareIdentityKey({ reportType: "maps_campaign" }),
      "maps_campaign:default"
    );
  });
});
