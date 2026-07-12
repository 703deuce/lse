-- Per-cell provider latency telemetry for production optimization

CREATE TABLE IF NOT EXISTS scan_cell_telemetry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_batch_id UUID NOT NULL REFERENCES scan_batches(id) ON DELETE CASCADE,
  scan_point_id UUID REFERENCES scan_points(id) ON DELETE SET NULL,
  keyword_id UUID,
  grid_label TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'brightdata',
  concurrency INTEGER,
  api_latency_ms INTEGER,
  matching_ms INTEGER,
  db_save_ms INTEGER,
  total_ms INTEGER,
  attempts INTEGER NOT NULL DEFAULT 1,
  success BOOLEAN NOT NULL,
  timed_out BOOLEAN NOT NULL DEFAULT false,
  error_message TEXT,
  distance_from_center_m DOUBLE PRECISION,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  pass_label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_scan_cell_telemetry_batch ON scan_cell_telemetry(scan_batch_id);
CREATE INDEX IF NOT EXISTS idx_scan_cell_telemetry_created ON scan_cell_telemetry(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_cell_telemetry_provider ON scan_cell_telemetry(provider, success);
