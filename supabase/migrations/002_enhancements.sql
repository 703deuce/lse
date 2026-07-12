-- RLS on remaining tables
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON competitors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON job_queue FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON profiles FOR ALL USING (true) WITH CHECK (true);

-- FK for competitor_snapshots
ALTER TABLE competitor_snapshots
  DROP CONSTRAINT IF EXISTS competitor_snapshots_scan_batch_id_fkey;
ALTER TABLE competitor_snapshots
  ADD CONSTRAINT competitor_snapshots_scan_batch_id_fkey
  FOREIGN KEY (scan_batch_id) REFERENCES scan_batches(id) ON DELETE CASCADE;

-- Pending async provider tasks (Standard DataForSEO method)
CREATE TABLE scan_provider_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_batch_id UUID NOT NULL REFERENCES scan_batches(id) ON DELETE CASCADE,
  scan_point_id UUID NOT NULL REFERENCES scan_points(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES business_keywords(id) ON DELETE CASCADE,
  external_task_id TEXT,
  tag TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  result_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_provider_tasks_batch ON scan_provider_tasks(scan_batch_id);
CREATE INDEX idx_scan_provider_tasks_external ON scan_provider_tasks(external_task_id);

ALTER TABLE scan_provider_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON scan_provider_tasks FOR ALL USING (true) WITH CHECK (true);

-- Scheduled recurring scans
CREATE TABLE scheduled_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  cron_expression TEXT NOT NULL DEFAULT '0 9 * * 1',
  grid_size INTEGER NOT NULL DEFAULT 5,
  radius_meters INTEGER NOT NULL DEFAULT 2000,
  enabled BOOLEAN NOT NULL DEFAULT true,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_scans_business ON scheduled_scans(business_id);
ALTER TABLE scheduled_scans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON scheduled_scans FOR ALL USING (true) WITH CHECK (true);

-- Report HTML storage (private text blob until Storage bucket wired)
ALTER TABLE reports ADD COLUMN IF NOT EXISTS html_content TEXT;

-- PostGIS geom helpers
CREATE OR REPLACE FUNCTION set_business_geom(p_id UUID, p_lng DOUBLE PRECISION, p_lat DOUBLE PRECISION)
RETURNS VOID AS $$
BEGIN
  UPDATE businesses
  SET geom = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  WHERE id = p_id AND p_lng IS NOT NULL AND p_lat IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION set_scan_point_geom(p_id UUID, p_lng DOUBLE PRECISION, p_lat DOUBLE PRECISION)
RETURNS VOID AS $$
BEGIN
  UPDATE scan_points
  SET geom = ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326)::geography
  WHERE id = p_id;
END;
$$ LANGUAGE plpgsql;

-- Process due scheduled scans (call via Supabase Cron HTTP or pg_cron)
CREATE OR REPLACE FUNCTION process_due_scheduled_scans()
RETURNS INTEGER AS $$
DECLARE
  rec RECORD;
  new_batch_id UUID;
  count INTEGER := 0;
BEGIN
  FOR rec IN
    SELECT * FROM scheduled_scans
    WHERE enabled = true
      AND (next_run_at IS NULL OR next_run_at <= now())
    LIMIT 20
  LOOP
    INSERT INTO scan_batches (business_id, status, scan_type, grid_size, radius_meters)
    VALUES (rec.business_id, 'queued', 'quick', rec.grid_size, rec.radius_meters)
    RETURNING id INTO new_batch_id;

    INSERT INTO job_queue (job_type, payload, status)
    VALUES ('process_scan', jsonb_build_object('scanBatchId', new_batch_id), 'pending');

    UPDATE scheduled_scans
    SET last_run_at = now(), next_run_at = now() + interval '7 days'
    WHERE id = rec.id;

    count := count + 1;
  END LOOP;
  RETURN count;
END;
$$ LANGUAGE plpgsql;

-- Supabase Cron: enable in dashboard, schedule weekly:
-- SELECT cron.schedule('weekly-scans', '0 9 * * 1', $$ SELECT process_due_scheduled_scans(); $$);
