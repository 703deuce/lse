-- AI Visibility / AI Prompt Tracker

CREATE TABLE IF NOT EXISTS ai_visibility_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  prompt_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('active', 'suggested', 'archived')),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  category TEXT,
  intent_type TEXT,
  opportunity_score INTEGER,
  reason TEXT,
  engines JSONB NOT NULL DEFAULT '["chatgpt","perplexity","gemini","google_ai_overview"]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_visibility_prompts_business
  ON ai_visibility_prompts(business_id, status, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_visibility_primary_prompt
  ON ai_visibility_prompts(business_id)
  WHERE is_primary = true AND status = 'active';

CREATE TABLE IF NOT EXISTS ai_visibility_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'complete', 'failed')),
  prompts_checked INTEGER NOT NULL DEFAULT 0,
  engines_checked INTEGER NOT NULL DEFAULT 0,
  visibility_score INTEGER,
  target_mentioned BOOLEAN,
  mention_position INTEGER,
  competitor_count INTEGER NOT NULL DEFAULT 0,
  sources_count INTEGER NOT NULL DEFAULT 0,
  fanouts_count INTEGER NOT NULL DEFAULT 0,
  ai_summary TEXT,
  ai_json JSONB NOT NULL DEFAULT '{}',
  progress_stage TEXT,
  error_message TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_visibility_runs_business
  ON ai_visibility_runs(business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS ai_visibility_engine_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES ai_visibility_runs(id) ON DELETE CASCADE,
  prompt_id UUID NOT NULL REFERENCES ai_visibility_prompts(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  engine TEXT NOT NULL
    CHECK (engine IN ('chatgpt', 'perplexity', 'gemini', 'google_ai_overview')),
  status TEXT NOT NULL DEFAULT 'complete'
    CHECK (status IN ('complete', 'failed', 'skipped')),
  target_mentioned BOOLEAN NOT NULL DEFAULT false,
  mention_position INTEGER,
  competitors_json JSONB NOT NULL DEFAULT '[]',
  sources_json JSONB NOT NULL DEFAULT '[]',
  fanouts_json JSONB NOT NULL DEFAULT '[]',
  answer_text TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}',
  error_message TEXT,
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_visibility_results_run
  ON ai_visibility_engine_results(run_id, engine);

ALTER TABLE ai_visibility_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_visibility_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE ai_visibility_engine_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON ai_visibility_prompts FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON ai_visibility_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON ai_visibility_engine_results FOR ALL USING (true) WITH CHECK (true);
