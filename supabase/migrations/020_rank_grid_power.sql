-- Rank Grid power features: saved locations, per-scan center, single-point checks

CREATE TABLE IF NOT EXISTS rank_locations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  address TEXT,
  city TEXT,
  state TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  default_grid_size INTEGER NOT NULL DEFAULT 7,
  default_radius_miles NUMERIC(6,2) NOT NULL DEFAULT 5.0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_rank_locations_business ON rank_locations(business_id, created_at DESC);

ALTER TABLE scan_batches
  ADD COLUMN IF NOT EXISTS location_id UUID REFERENCES rank_locations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS center_lat DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS center_lng DOUBLE PRECISION,
  ADD COLUMN IF NOT EXISTS center_label TEXT,
  ADD COLUMN IF NOT EXISTS moved_from_scan_id UUID REFERENCES scan_batches(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_scan_batches_location ON scan_batches(business_id, location_id, created_at DESC);

CREATE TABLE IF NOT EXISTS single_point_rank_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  location_id UUID REFERENCES rank_locations(id) ON DELETE SET NULL,
  keyword TEXT NOT NULL,
  keyword_id UUID REFERENCES business_keywords(id) ON DELETE SET NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  label TEXT,
  rank INTEGER,
  rank_bucket TEXT,
  visibility_score NUMERIC(5,2),
  result_count INTEGER NOT NULL DEFAULT 0,
  raw_results JSONB NOT NULL DEFAULT '[]',
  matched_result JSONB,
  match_reason TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_single_point_checks_business ON single_point_rank_checks(business_id, checked_at DESC);

ALTER TABLE rank_locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE single_point_rank_checks ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'rank_locations' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON rank_locations FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'single_point_rank_checks' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON single_point_rank_checks FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
