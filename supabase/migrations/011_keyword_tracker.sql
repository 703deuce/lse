-- Maps Keyword Rank Tracker

CREATE TABLE tracked_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  location_name TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  search_volume INTEGER,
  search_volume_source TEXT,
  tracking_frequency TEXT NOT NULL DEFAULT 'weekly'
    CHECK (tracking_frequency IN ('daily', 'weekly')),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, keyword)
);

CREATE INDEX idx_tracked_keywords_business ON tracked_keywords(business_id, active, created_at DESC);

CREATE TABLE keyword_rank_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  tracked_keyword_id UUID NOT NULL REFERENCES tracked_keywords(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  rank INTEGER,
  rank_bucket TEXT NOT NULL DEFAULT 'unranked'
    CHECK (rank_bucket IN ('top3', 'top10', 'top20', 'beyond', 'unranked')),
  visibility_score NUMERIC NOT NULL DEFAULT 0,
  result_count INTEGER NOT NULL DEFAULT 0,
  matched_by TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_keyword_rank_checks_keyword ON keyword_rank_checks(tracked_keyword_id, checked_at DESC);
CREATE INDEX idx_keyword_rank_checks_business ON keyword_rank_checks(business_id, checked_at DESC);

CREATE TABLE keyword_suggestions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  search_volume INTEGER,
  intent_type TEXT NOT NULL DEFAULT 'service'
    CHECK (intent_type IN ('service', 'city', 'problem', 'near_me', 'commercial')),
  priority TEXT NOT NULL DEFAULT 'medium'
    CHECK (priority IN ('high', 'medium', 'low')),
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'suggested'
    CHECK (status IN ('suggested', 'added', 'dismissed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_keyword_suggestions_business ON keyword_suggestions(business_id, status, created_at DESC);

ALTER TABLE tracked_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_rank_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE keyword_suggestions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all" ON tracked_keywords FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON keyword_rank_checks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON keyword_suggestions FOR ALL USING (true) WITH CHECK (true);
