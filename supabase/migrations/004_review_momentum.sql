-- Review Momentum: normalized reviews + momentum report runs

CREATE TABLE business_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  source_review_id TEXT,
  reviewer_name TEXT,
  rating NUMERIC,
  review_text TEXT,
  review_date DATE,
  relative_date_text TEXT,
  owner_response_text TEXT,
  review_url TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (business_id IS NOT NULL OR competitor_id IS NOT NULL)
);

CREATE UNIQUE INDEX idx_business_reviews_source_id
  ON business_reviews (source_provider, source_review_id)
  WHERE source_review_id IS NOT NULL;

CREATE INDEX idx_business_reviews_business ON business_reviews(business_id);
CREATE INDEX idx_business_reviews_competitor ON business_reviews(competitor_id);
CREATE INDEX idx_business_reviews_org ON business_reviews(organization_id);
CREATE INDEX idx_business_reviews_date ON business_reviews(review_date);

CREATE TABLE review_momentum_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scan_batch_id UUID REFERENCES scan_batches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'ready', 'partial', 'failed')),
  lookback_days INT NOT NULL DEFAULT 90,
  competitor_limit INT NOT NULL DEFAULT 5,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  ai_summary TEXT,
  ai_model TEXT,
  warnings JSONB NOT NULL DEFAULT '[]',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_momentum_runs_business ON review_momentum_runs(business_id, created_at DESC);

CREATE TABLE review_momentum_entities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES review_momentum_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('target', 'competitor')),
  name TEXT NOT NULL,
  total_reviews_current INT NOT NULL DEFAULT 0,
  rating_current NUMERIC,
  reviews_7d INT NOT NULL DEFAULT 0,
  reviews_30d INT NOT NULL DEFAULT 0,
  reviews_90d INT NOT NULL DEFAULT 0,
  reviews_yesterday INT NOT NULL DEFAULT 0,
  avg_reviews_per_week NUMERIC NOT NULL DEFAULT 0,
  days_since_last_review INT,
  acceleration_pct NUMERIC,
  consistency_score NUMERIC NOT NULL DEFAULT 0,
  velocity_score NUMERIC NOT NULL DEFAULT 0,
  recency_score NUMERIC NOT NULL DEFAULT 0,
  momentum_score NUMERIC NOT NULL DEFAULT 0,
  momentum_label TEXT NOT NULL DEFAULT 'Dormant',
  gap_to_top3_30d INT,
  recommended_weekly_target NUMERIC,
  metrics_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_momentum_entities_run ON review_momentum_entities(run_id);

CREATE TABLE review_momentum_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id UUID NOT NULL REFERENCES review_momentum_runs(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  impact TEXT NOT NULL DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high')),
  effort TEXT NOT NULL DEFAULT 'medium' CHECK (effort IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'done')),
  evidence_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_momentum_tasks_run ON review_momentum_tasks(run_id);
CREATE INDEX idx_review_momentum_tasks_business ON review_momentum_tasks(business_id);
