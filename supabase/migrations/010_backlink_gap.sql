-- Competitor Backlink Gap module

CREATE TABLE backlink_gap_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scan_batch_id UUID REFERENCES scan_batches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'ready', 'partial', 'failed')),
  target_domain TEXT NOT NULL,
  competitor_limit INTEGER NOT NULL DEFAULT 5,
  selected_competitors JSONB NOT NULL DEFAULT '[]',
  target_ref_domain_count INTEGER NOT NULL DEFAULT 0,
  competitor_ref_domain_count INTEGER NOT NULL DEFAULT 0,
  missing_opportunity_count INTEGER NOT NULL DEFAULT 0,
  high_priority_count INTEGER NOT NULL DEFAULT 0,
  ai_summary TEXT,
  progress_stage TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_backlink_gap_runs_business ON backlink_gap_runs(business_id, created_at DESC);

CREATE TABLE backlink_gap_opportunities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES backlink_gap_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  referring_domain TEXT NOT NULL,
  source_url TEXT,
  source_title TEXT,
  source_type TEXT NOT NULL DEFAULT 'Unknown',
  domain_rank NUMERIC,
  authority_score NUMERIC,
  competitor_count INTEGER NOT NULL DEFAULT 0,
  linked_competitors JSONB NOT NULL DEFAULT '[]',
  target_has_link BOOLEAN NOT NULL DEFAULT false,
  anchor_text TEXT,
  dofollow BOOLEAN,
  first_seen DATE,
  last_seen DATE,
  opportunity_score NUMERIC,
  priority TEXT NOT NULL DEFAULT 'low'
    CHECK (priority IN ('high', 'medium', 'low', 'ignore')),
  suggested_action TEXT,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'ignored', 'completed', 'spam')),
  raw_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_backlink_gap_opportunities_run ON backlink_gap_opportunities(run_id);
CREATE INDEX idx_backlink_gap_opportunities_priority ON backlink_gap_opportunities(run_id, priority);

CREATE TABLE backlink_gap_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES backlink_gap_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  opportunity_id UUID REFERENCES backlink_gap_opportunities(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  impact TEXT NOT NULL DEFAULT 'medium'
    CHECK (impact IN ('high', 'medium', 'low')),
  effort TEXT NOT NULL DEFAULT 'medium'
    CHECK (effort IN ('high', 'medium', 'low')),
  status TEXT NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'in_progress', 'done')),
  evidence_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_backlink_gap_tasks_run ON backlink_gap_tasks(run_id);

ALTER TABLE backlink_gap_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlink_gap_opportunities ENABLE ROW LEVEL SECURITY;
ALTER TABLE backlink_gap_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON backlink_gap_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON backlink_gap_opportunities FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON backlink_gap_tasks FOR ALL USING (true) WITH CHECK (true);
