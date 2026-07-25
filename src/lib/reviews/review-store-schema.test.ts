import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  isMissingReviewSchemaColumnError,
  toLegacyReviewUpsertRow,
} from "./review-store";

describe("review-store schema fallbacks", () => {
  it("detects PostgREST missing-column errors from production logs", () => {
    assert.equal(
      isMissingReviewSchemaColumnError(
        "Could not find the 'absent_pull_count' column of 'business_reviews' in the schema cache"
      ),
      true
    );
    assert.equal(
      isMissingReviewSchemaColumnError('column "published_at" does not exist'),
      true
    );
    assert.equal(isMissingReviewSchemaColumnError("permission denied for table business_reviews"), false);
  });

  it("strips intelligence columns for pre-077 upserts", () => {
    const legacy = toLegacyReviewUpsertRow({
      organization_id: "org-1",
      business_id: "biz-1",
      competitor_id: null,
      source_provider: "scrapingdog",
      source_review_id: "rev-1",
      reviewer_name: "Alex",
      rating: 5,
      review_text: "Great",
      review_date: "2026-07-01",
      relative_date_text: "3 weeks ago",
      owner_response_text: null,
      review_url: null,
      raw_json: { ok: true },
      updated_at: "2026-07-25T00:00:00.000Z",
      published_at: "2026-07-01T00:00:00.000Z",
      last_edited_at: null,
      first_observed_at: "2026-07-25T00:00:00.000Z",
      last_observed_at: "2026-07-25T00:00:00.000Z",
      owner_responded_at: null,
      date_precision: "estimated",
      is_deleted: false,
      absent_pull_count: 0,
    });

    assert.deepEqual(legacy, {
      organization_id: "org-1",
      business_id: "biz-1",
      competitor_id: null,
      source_provider: "scrapingdog",
      source_review_id: "rev-1",
      reviewer_name: "Alex",
      rating: 5,
      review_text: "Great",
      review_date: "2026-07-01",
      relative_date_text: "3 weeks ago",
      owner_response_text: null,
      review_url: null,
      raw_json: { ok: true },
      updated_at: "2026-07-25T00:00:00.000Z",
    });
    assert.equal("absent_pull_count" in legacy, false);
    assert.equal("published_at" in legacy, false);
  });
});
