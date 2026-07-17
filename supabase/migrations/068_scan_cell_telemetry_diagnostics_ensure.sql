-- Ensure Maps cell telemetry diagnostics columns exist (idempotent).
-- Fixes production: "Could not find the 'failure_category' column of 'scan_cell_telemetry'"
-- After applying, reload the PostgREST schema cache (Supabase: NOTIFY pgrst, 'reload schema').

ALTER TABLE scan_cell_telemetry
  ADD COLUMN IF NOT EXISTS failure_category TEXT,
  ADD COLUMN IF NOT EXISTS provider_diagnostics JSONB;

CREATE INDEX IF NOT EXISTS idx_scan_cell_telemetry_failure_category
  ON scan_cell_telemetry (failure_category)
  WHERE failure_category IS NOT NULL;

COMMENT ON COLUMN scan_cell_telemetry.failure_category IS
  'Normalized provider failure category (http_504, empty_body, provider_timeout, …)';
COMMENT ON COLUMN scan_cell_telemetry.provider_diagnostics IS
  'Redacted provider diagnostics + attempt provenance for Maps multi-provider recovery';

-- Nudge PostgREST when available (no-op if channel absent).
DO $$
BEGIN
  PERFORM pg_notify('pgrst', 'reload schema');
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
