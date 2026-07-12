-- Store DeepSeek-extracted company mentions per engine result
ALTER TABLE ai_visibility_engine_results
  ADD COLUMN IF NOT EXISTS mentions_json JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS idx_ai_visibility_results_business_checked
  ON ai_visibility_engine_results(business_id, checked_at DESC);
