-- Share report capability tokens can expire / be revoked.
ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS share_expires_at TIMESTAMPTZ;

-- Existing shares: give a 90-day window from generation (null would mean forever).
UPDATE reports
SET share_expires_at = COALESCE(generated_at, now()) + INTERVAL '90 days'
WHERE share_token IS NOT NULL
  AND share_expires_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_reports_share_token_active
  ON reports (share_token)
  WHERE share_token IS NOT NULL;
