-- Precomputed map workspace artifacts (entity grids, fingerprints, cell why, compare)

CREATE TABLE IF NOT EXISTS scan_workspace_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_batch_id UUID NOT NULL REFERENCES scan_batches(id) ON DELETE CASCADE,
  cache_type TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (scan_batch_id, cache_type, cache_key)
);

CREATE INDEX IF NOT EXISTS idx_scan_workspace_cache_lookup
  ON scan_workspace_cache(scan_batch_id, cache_type, cache_key);

ALTER TABLE scan_workspace_cache ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'scan_workspace_cache' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON scan_workspace_cache FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
