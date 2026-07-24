-- Phase 1: Review intelligence data foundation
-- Exact publish/edit timestamps, observation tracking, soft-delete, business timezone

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York';

ALTER TABLE business_reviews
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_edited_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS first_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS last_observed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS owner_responded_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS date_precision TEXT NOT NULL DEFAULT 'unknown'
    CHECK (date_precision IN ('exact', 'estimated', 'unknown')),
  ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS absent_pull_count INT NOT NULL DEFAULT 0;

-- Backfill published_at from review_date where possible (date-only → UTC midnight)
UPDATE business_reviews
SET published_at = (review_date::timestamptz)
WHERE published_at IS NULL
  AND review_date IS NOT NULL;

UPDATE business_reviews
SET date_precision = 'estimated'
WHERE date_precision = 'unknown'
  AND review_date IS NOT NULL
  AND published_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_business_reviews_published_at
  ON business_reviews (business_id, published_at DESC NULLS LAST)
  WHERE business_id IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_business_reviews_competitor_published_at
  ON business_reviews (competitor_id, published_at DESC NULLS LAST)
  WHERE competitor_id IS NOT NULL AND is_deleted = false;

CREATE INDEX IF NOT EXISTS idx_business_reviews_last_observed
  ON business_reviews (business_id, last_observed_at DESC)
  WHERE business_id IS NOT NULL;

-- Immutable-ish snapshot history for edit detection / audits
CREATE TABLE IF NOT EXISTS business_review_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id UUID NOT NULL REFERENCES business_reviews(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  source_review_id TEXT,
  rating NUMERIC,
  review_text TEXT,
  published_at TIMESTAMPTZ,
  last_edited_at TIMESTAMPTZ,
  owner_response_text TEXT,
  owner_responded_at TIMESTAMPTZ,
  relative_date_text TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  observed_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_business_review_snapshots_review
  ON business_review_snapshots (review_id, observed_at DESC);

-- Expandable reputation alerts inbox (active / resolved)
CREATE TABLE IF NOT EXISTS reputation_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'medium'
    CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  title TEXT NOT NULL,
  body TEXT,
  recommended_action TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'resolved', 'dismissed')),
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reputation_alerts_business_status
  ON reputation_alerts (business_id, status, created_at DESC);

-- Extend notification settings with more alert categories (additive, default off)
ALTER TABLE review_notification_settings
  ADD COLUMN IF NOT EXISTS velocity_drop BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS competitor_velocity_spike BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS no_reviews_days INT NOT NULL DEFAULT 14,
  ADD COLUMN IF NOT EXISTS rating_changed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS response_overdue BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS campaign_delivery_problem BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS review_gap_widening BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS maps_visibility_moved BOOLEAN NOT NULL DEFAULT false;
