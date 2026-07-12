-- Incremental review sync + per-entity dedupe for business_reviews

ALTER TABLE business_reviews
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP INDEX IF EXISTS idx_business_reviews_source_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_reviews_biz_source
  ON business_reviews (business_id, source_provider, source_review_id)
  WHERE business_id IS NOT NULL AND source_review_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_reviews_comp_source
  ON business_reviews (competitor_id, source_provider, source_review_id)
  WHERE competitor_id IS NOT NULL AND source_review_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS review_sync_state (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  last_sync_at TIMESTAMPTZ,
  last_review_date_seen DATE,
  known_review_ids JSONB NOT NULL DEFAULT '[]',
  lookback_days INT NOT NULL DEFAULT 90,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (business_id IS NOT NULL OR competitor_id IS NOT NULL)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_sync_state_business
  ON review_sync_state (business_id)
  WHERE business_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_sync_state_competitor
  ON review_sync_state (competitor_id)
  WHERE competitor_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_reviews_business_date
  ON business_reviews (business_id, review_date DESC)
  WHERE business_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_reviews_competitor_date
  ON business_reviews (competitor_id, review_date DESC)
  WHERE competitor_id IS NOT NULL;
