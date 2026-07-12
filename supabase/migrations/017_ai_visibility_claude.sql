-- Add Claude as a supported AI visibility engine
ALTER TABLE ai_visibility_engine_results
  DROP CONSTRAINT IF EXISTS ai_visibility_engine_results_engine_check;

ALTER TABLE ai_visibility_engine_results
  ADD CONSTRAINT ai_visibility_engine_results_engine_check
  CHECK (engine IN ('chatgpt', 'perplexity', 'gemini', 'google_ai_overview', 'claude'));
