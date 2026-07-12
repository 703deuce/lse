-- Module audit runs (website match, category gap, core30, etc.)
CREATE TABLE IF NOT EXISTS module_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  module_type TEXT NOT NULL,
  score INTEGER,
  result_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_module_audits_business ON module_audits(business_id);
CREATE INDEX IF NOT EXISTS idx_module_audits_type ON module_audits(business_id, module_type, created_at DESC);

ALTER TABLE module_audits ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_all" ON module_audits FOR ALL USING (true) WITH CHECK (true);
