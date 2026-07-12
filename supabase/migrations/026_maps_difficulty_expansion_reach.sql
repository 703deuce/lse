-- Expansion Reach data on Maps Keyword Difficulty runs

ALTER TABLE maps_difficulty_runs
  ADD COLUMN IF NOT EXISTS expansion_json JSONB,
  ADD COLUMN IF NOT EXISTS business_base_address TEXT,
  ADD COLUMN IF NOT EXISTS expansion_score INTEGER,
  ADD COLUMN IF NOT EXISTS expansion_label TEXT;
