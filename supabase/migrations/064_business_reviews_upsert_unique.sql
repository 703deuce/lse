-- Fix Review Momentum upsert into business_reviews.
--
-- migration 027 created PARTIAL unique indexes:
--   UNIQUE (business_id, source_provider, source_review_id) WHERE business_id IS NOT NULL ...
-- PostgREST/Supabase `.upsert({ onConflict: "business_id,source_provider,source_review_id" })`
-- emits `ON CONFLICT (cols)` without that WHERE predicate, so Postgres raises:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Replace with non-partial unique indexes on the same columns. NULL entity ids are
-- still allowed (PostgreSQL treats NULLs as distinct in unique indexes), so
-- competitor rows (business_id NULL) and business rows (competitor_id NULL) coexist.
--
-- review_sync_state keeps its partial uniques — a non-partial UNIQUE(business_id)
-- would incorrectly allow only one NULL business_id row. The app falls back to
-- select/update/insert when that upsert cannot use ON CONFLICT.

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY business_id, source_provider, source_review_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS rn
  FROM business_reviews
  WHERE business_id IS NOT NULL
    AND source_provider IS NOT NULL
    AND source_review_id IS NOT NULL
)
DELETE FROM business_reviews br
USING ranked r
WHERE br.id = r.id
  AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    row_number() OVER (
      PARTITION BY competitor_id, source_provider, source_review_id
      ORDER BY updated_at DESC NULLS LAST, created_at DESC NULLS LAST, id
    ) AS rn
  FROM business_reviews
  WHERE competitor_id IS NOT NULL
    AND source_provider IS NOT NULL
    AND source_review_id IS NOT NULL
)
DELETE FROM business_reviews br
USING ranked r
WHERE br.id = r.id
  AND r.rn > 1;

DROP INDEX IF EXISTS idx_business_reviews_biz_source;
DROP INDEX IF EXISTS idx_business_reviews_comp_source;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_reviews_biz_source
  ON business_reviews (business_id, source_provider, source_review_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_reviews_comp_source
  ON business_reviews (competitor_id, source_provider, source_review_id);
