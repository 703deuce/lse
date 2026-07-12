-- Unified Google Maps Growth Audit runs
CREATE TABLE IF NOT EXISTS growth_audit_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'core_ready', 'extended_running', 'complete', 'failed')),
  growth_score INTEGER,
  scan_batch_id UUID REFERENCES scan_batches(id) ON DELETE SET NULL,
  sections_json JSONB NOT NULL DEFAULT '{}',
  growth_plan_json JSONB NOT NULL DEFAULT '[]',
  extended_json JSONB NOT NULL DEFAULT '{}',
  progress_stage TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_growth_audit_runs_business ON growth_audit_runs(business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_growth_audit_runs_org ON growth_audit_runs(organization_id);

ALTER TABLE growth_audit_runs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON growth_audit_runs FOR ALL USING (true) WITH CHECK (true);
