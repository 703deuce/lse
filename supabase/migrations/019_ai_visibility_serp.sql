-- Google map pack + organic SERP snapshot per visibility run
ALTER TABLE ai_visibility_runs
  ADD COLUMN IF NOT EXISTS serp_keyword TEXT,
  ADD COLUMN IF NOT EXISTS map_pack_json JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS organic_serp_json JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS serp_match_json JSONB NOT NULL DEFAULT '[]';
