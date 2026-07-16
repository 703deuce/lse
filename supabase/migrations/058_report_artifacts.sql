-- Durable report artifacts (PDF / map / heatmap) for Local Rank Grid exports.
-- HTML share links continue to use html_content + share_token.

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS artifact_kind TEXT,
  ADD COLUMN IF NOT EXISTS artifact_status TEXT NOT NULL DEFAULT 'ready',
  ADD COLUMN IF NOT EXISTS template_version TEXT,
  ADD COLUMN IF NOT EXISTS branding_version TEXT,
  ADD COLUMN IF NOT EXISTS data_version TEXT,
  ADD COLUMN IF NOT EXISTS artifact_bytes BIGINT,
  ADD COLUMN IF NOT EXISTS generation_ms INTEGER,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS content_type TEXT;

COMMENT ON COLUMN reports.artifact_kind IS
  'html_share | pdf | map_png | heatmap_png | summary_csv | points_csv — null for legacy HTML rows';
COMMENT ON COLUMN reports.artifact_status IS
  'pending | generating | ready | failed';
COMMENT ON COLUMN reports.storage_path IS
  'Object storage path under reports bucket when artifact is a binary file';

CREATE INDEX IF NOT EXISTS idx_reports_artifact_lookup
  ON reports (business_id, scan_batch_id, artifact_kind, template_version)
  WHERE artifact_kind IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_reports_artifact_status
  ON reports (artifact_status)
  WHERE artifact_status IN ('pending', 'generating');

-- Ensure private reports storage bucket exists for PDF/map/heatmap artifacts.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'reports',
  'reports',
  false,
  52428800,
  ARRAY['application/pdf', 'image/png', 'text/csv']::text[]
)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;
