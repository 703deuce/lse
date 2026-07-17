-- Normalized Bright Data / Maps cell failure diagnostics (no retry policy changes).

ALTER TABLE scan_cell_telemetry
  ADD COLUMN IF NOT EXISTS failure_category TEXT,
  ADD COLUMN IF NOT EXISTS provider_diagnostics JSONB;

CREATE INDEX IF NOT EXISTS idx_scan_cell_telemetry_failure_category
  ON scan_cell_telemetry (failure_category)
  WHERE failure_category IS NOT NULL;

COMMENT ON COLUMN scan_cell_telemetry.failure_category IS
  'Normalized provider failure category (http_error, empty_maps_results, provider_timeout, …)';
COMMENT ON COLUMN scan_cell_telemetry.provider_diagnostics IS
  'Redacted provider diagnostics: http status, byte count, schema keys, markers, body preview';
