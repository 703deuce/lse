-- Enforce one shareable report per (business, reportType, identityKey).
-- Prevents concurrent creates from inserting duplicate share rows.
CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_business_identity
  ON reports (
    business_id,
    ((metadata_json ->> 'reportType')),
    ((metadata_json ->> 'identityKey'))
  )
  WHERE metadata_json ? 'identityKey'
    AND nullif(metadata_json ->> 'identityKey', '') IS NOT NULL;
