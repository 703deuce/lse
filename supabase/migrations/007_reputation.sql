-- Reputation / Reviews module (separate from review_momentum_runs)

CREATE TABLE reputation_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scan_batch_id UUID REFERENCES scan_batches(id) ON DELETE SET NULL,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'ready', 'partial', 'failed')),
  score INTEGER,
  rating NUMERIC,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  reviews_7d INTEGER NOT NULL DEFAULT 0,
  reviews_30d INTEGER NOT NULL DEFAULT 0,
  reviews_90d INTEGER NOT NULL DEFAULT 0,
  momentum_label TEXT,
  momentum_score NUMERIC,
  response_rate NUMERIC,
  review_gap INTEGER,
  recommended_weekly_target INTEGER,
  ai_summary TEXT,
  metrics_json JSONB NOT NULL DEFAULT '{}',
  warnings JSONB NOT NULL DEFAULT '[]',
  progress_stage TEXT,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reputation_audits_business ON reputation_audits(business_id, created_at DESC);

CREATE TABLE review_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES competitors(id) ON DELETE CASCADE,
  audit_id UUID REFERENCES reputation_audits(id) ON DELETE CASCADE,
  source_provider TEXT NOT NULL,
  source_review_id TEXT,
  reviewer_name TEXT,
  rating NUMERIC,
  review_text TEXT,
  relative_date_text TEXT,
  date_bucket_start DATE,
  date_bucket_end DATE,
  date_confidence TEXT DEFAULT 'medium',
  exact_day BOOLEAN NOT NULL DEFAULT false,
  owner_response_text TEXT,
  owner_response_present BOOLEAN NOT NULL DEFAULT false,
  review_url TEXT,
  sentiment TEXT,
  service_keywords TEXT[] NOT NULL DEFAULT '{}',
  trust_keywords TEXT[] NOT NULL DEFAULT '{}',
  location_keywords TEXT[] NOT NULL DEFAULT '{}',
  raw_json JSONB NOT NULL DEFAULT '{}',
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (business_id IS NOT NULL OR competitor_id IS NOT NULL)
);

CREATE INDEX idx_review_records_audit ON review_records(audit_id);
CREATE INDEX idx_review_records_business ON review_records(business_id);

CREATE TABLE reputation_competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES reputation_audits(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL,
  competitor_name TEXT NOT NULL,
  rating NUMERIC,
  total_reviews INTEGER NOT NULL DEFAULT 0,
  reviews_7d INTEGER NOT NULL DEFAULT 0,
  reviews_30d INTEGER NOT NULL DEFAULT 0,
  reviews_90d INTEGER NOT NULL DEFAULT 0,
  avg_reviews_per_week NUMERIC,
  days_since_last_review INTEGER,
  response_rate NUMERIC,
  momentum_score NUMERIC,
  momentum_label TEXT,
  keyword_strengths JSONB NOT NULL DEFAULT '{}',
  velocity_available BOOLEAN NOT NULL DEFAULT true,
  raw_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reputation_competitors_audit ON reputation_competitors(audit_id);

CREATE TABLE review_keyword_gaps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES reputation_audits(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  keyword_type TEXT NOT NULL DEFAULT 'service',
  target_count INTEGER NOT NULL DEFAULT 0,
  competitor_avg NUMERIC NOT NULL DEFAULT 0,
  competitor_max INTEGER NOT NULL DEFAULT 0,
  gap NUMERIC NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  recommendation TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_keyword_gaps_audit ON review_keyword_gaps(audit_id);

CREATE TABLE review_response_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES reputation_audits(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  review_record_id UUID NOT NULL REFERENCES review_records(id) ON DELETE CASCADE,
  draft_text TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'used', 'dismissed')),
  ai_model TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_response_drafts_audit ON review_response_drafts(audit_id);

CREATE TABLE reputation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES reputation_audits(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  impact TEXT NOT NULL DEFAULT 'medium' CHECK (impact IN ('low', 'medium', 'high')),
  effort TEXT NOT NULL DEFAULT 'medium' CHECK (effort IN ('low', 'medium', 'high')),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'skipped')),
  evidence_json JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_reputation_tasks_audit ON reputation_tasks(audit_id);
CREATE INDEX idx_reputation_tasks_business ON reputation_tasks(business_id, created_at DESC);
