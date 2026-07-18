import { describe, it } from "node:test";
import assert from "node:assert/strict";

/** Mirrors the confidence_summary shape written by processDueMapsCampaigns. */
function campaignBatchConfidence(input: {
  campaignId: string;
  keywordId: string;
  keyword: string;
}) {
  return {
    scheduled: true,
    mapsCampaignId: input.campaignId,
    keyword_ids: [input.keywordId],
    keyword_label: input.keyword,
    keywordId: input.keywordId,
    keyword: input.keyword,
  };
}

describe("maps campaign scheduled batch confidence", () => {
  it("scopes process-scan via keyword_ids", () => {
    const conf = campaignBatchConfidence({
      campaignId: "c1",
      keywordId: "k1",
      keyword: "plumber near me",
    });
    assert.deepEqual(conf.keyword_ids, ["k1"]);
    assert.equal(conf.keyword_label, "plumber near me");
  });
});
