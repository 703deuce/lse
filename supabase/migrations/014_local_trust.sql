-- Local Trust / Sponsorship Finder
CREATE TABLE IF NOT EXISTS local_trust_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running' CHECK (status IN ('running', 'complete', 'failed')),
  city TEXT,
  county TEXT,
  state TEXT,
  keyword TEXT,
  opportunities_found INTEGER NOT NULL DEFAULT 0,
  high_priority_count INTEGER NOT NULL DEFAULT 0,
  local_relevance_score INTEGER,
  easy_wins_count INTEGER NOT NULL DEFAULT 0,
  ai_summary TEXT,
  ai_json JSONB NOT NULL DEFAULT '{}',
  search_queries_json JSONB NOT NULL DEFAULT '[]',
  progress_stage TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_local_trust_runs_business ON local_trust_runs(business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS local_trust_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES local_trust_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  domain TEXT,
  opportunity_type TEXT NOT NULL,
  city_match BOOLEAN NOT NULL DEFAULT false,
  county_match BOOLEAN NOT NULL DEFAULT false,
  topical_match BOOLEAN NOT NULL DEFAULT false,
  competitor_present BOOLEAN NOT NULL DEFAULT false,
  authority_score NUMERIC,
  relevance_score NUMERIC NOT NULL DEFAULT 0,
  difficulty TEXT NOT NULL DEFAULT 'medium',
  priority TEXT NOT NULL DEFAULT 'low',
  suggested_action TEXT,
  evidence_snippet TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  raw_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_local_trust_opps_run ON local_trust_opportunities(run_id);
CREATE INDEX IF NOT EXISTS idx_local_trust_opps_business ON local_trust_opportunities(business_id);

CREATE TABLE IF NOT EXISTS local_trust_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES local_trust_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES local_trust_opportunities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium',
  impact TEXT NOT NULL DEFAULT 'medium',
  effort TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'open',
  evidence_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_local_trust_tasks_run ON local_trust_tasks(run_id);

ALTER TABLE local_trust_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_trust_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE local_trust_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON local_trust_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON local_trust_opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON local_trust_tasks FOR ALL USING (true) WITH CHECK (true);
