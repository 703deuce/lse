-- Multi-market local trust scans + incremental candidate memory

ALTER TABLE local_trust_runs
  ADD COLUMN IF NOT EXISTS scan_type TEXT NOT NULL DEFAULT 'initial',
  ADD COLUMN IF NOT EXISTS rescan_summary_json JSONB NOT NULL DEFAULT '{}';

ALTER TABLE local_trust_opportunities
  ADD COLUMN IF NOT EXISTS market_city TEXT,
  ADD COLUMN IF NOT EXISTS market_state TEXT,
  ADD COLUMN IF NOT EXISTS market_county TEXT,
  ADD COLUMN IF NOT EXISTS search_query TEXT,
  ADD COLUMN IF NOT EXISTS canonical_url TEXT,
  ADD COLUMN IF NOT EXISTS content_hash TEXT,
  ADD COLUMN IF NOT EXISTS organization_key TEXT,
  ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_local_trust_opps_market
  ON local_trust_opportunities(business_id, market_city, market_state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_local_trust_opps_canonical
  ON local_trust_opportunities(business_id, canonical_url);

CREATE TABLE IF NOT EXISTS local_trust_candidates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  market_city TEXT NOT NULL,
  market_state TEXT NOT NULL,
  market_county TEXT,
  canonical_url TEXT NOT NULL,
  original_url TEXT NOT NULL,
  organization_key TEXT,
  title TEXT,
  domain TEXT,
  opportunity_type TEXT,
  candidate_status TEXT NOT NULL DEFAULT 'rejected',
  reject_reason TEXT,
  reject_stage TEXT,
  content_hash TEXT,
  skip_until TIMESTAMPTZ,
  first_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_run_id UUID REFERENCES local_trust_runs(id) ON DELETE SET NULL,
  opportunity_id UUID REFERENCES local_trust_opportunities(id) ON DELETE SET NULL,
  raw_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, market_city, market_state, canonical_url)
);

CREATE INDEX IF NOT EXISTS idx_local_trust_candidates_business_market
  ON local_trust_candidates(business_id, market_city, market_state);

CREATE INDEX IF NOT EXISTS idx_local_trust_candidates_skip
  ON local_trust_candidates(business_id, candidate_status, skip_until);

ALTER TABLE local_trust_candidates ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'local_trust_candidates' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON local_trust_candidates FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Backfill market columns from parent runs
UPDATE local_trust_opportunities o
SET
  market_city = r.city,
  market_state = r.state,
  market_county = r.county
FROM local_trust_runs r
WHERE o.run_id = r.id
  AND o.market_city IS NULL;
