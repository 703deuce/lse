-- Track how many SERP hits were filtered out by rules + LLM
ALTER TABLE local_trust_runs
  ADD COLUMN IF NOT EXISTS filtered_out_count INTEGER NOT NULL DEFAULT 0;
