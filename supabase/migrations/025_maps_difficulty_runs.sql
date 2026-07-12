-- Maps Keyword Difficulty run history

CREATE TABLE IF NOT EXISTS maps_difficulty_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID,
  keyword TEXT NOT NULL,
  city_label TEXT,
  service TEXT,
  address TEXT,
  search_lat DOUBLE PRECISION,
  search_lng DOUBLE PRECISION,
  mkd_score INTEGER,
  difficulty_label TEXT,
  score_json JSONB NOT NULL,
  businesses_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_maps_difficulty_runs_org_created
  ON maps_difficulty_runs(organization_id, created_at DESC);

ALTER TABLE maps_difficulty_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'maps_difficulty_runs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON maps_difficulty_runs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
