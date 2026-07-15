-- Templates archive + import rows payload for background contacts import

ALTER TABLE review_request_templates
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_review_templates_business_active
  ON review_request_templates(business_id, channel, is_default DESC)
  WHERE archived_at IS NULL;

ALTER TABLE review_request_uploads
  ADD COLUMN IF NOT EXISTS rows_json JSONB,
  ADD COLUMN IF NOT EXISTS mode TEXT DEFAULT 'update';

COMMENT ON COLUMN review_request_uploads.rows_json IS
  'Optional staged CSV rows for background import_contacts jobs';

-- Trackable redirects for one-off review request sends (same /r/{token} path)
ALTER TABLE review_request_sends
  ADD COLUMN IF NOT EXISTS tracking_token TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_sends_tracking_token
  ON review_request_sends(tracking_token)
  WHERE tracking_token IS NOT NULL;
