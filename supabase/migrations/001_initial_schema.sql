-- Enable PostGIS for geo queries
CREATE EXTENSION IF NOT EXISTS postgis;

-- Organizations & members
CREATE TABLE organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  plan TEXT NOT NULL DEFAULT 'free',
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE organization_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, user_id)
);

-- Businesses
CREATE TABLE businesses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  website_url TEXT,
  phone TEXT,
  address_text TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  geom GEOGRAPHY(POINT, 4326),
  place_id TEXT,
  cid TEXT,
  primary_category TEXT,
  service_area_mode TEXT NOT NULL DEFAULT 'storefront' CHECK (service_area_mode IN ('storefront', 'service_area')),
  scan_center_lat DOUBLE PRECISION,
  scan_center_lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_businesses_org ON businesses(organization_id);
CREATE INDEX idx_businesses_geom ON businesses USING GIST(geom);

CREATE TABLE business_keywords (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  is_primary BOOLEAN NOT NULL DEFAULT false,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'US',
  language_code TEXT DEFAULT 'en',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_business_keywords_business ON business_keywords(business_id);

-- Competitors
CREATE TABLE competitors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cid TEXT,
  place_id TEXT,
  name TEXT NOT NULL,
  website_url TEXT,
  phone TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE NULLS NOT DISTINCT (cid),
  UNIQUE NULLS NOT DISTINCT (place_id)
);

CREATE TABLE competitor_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_batch_id UUID NOT NULL,
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  category TEXT,
  additional_categories JSONB DEFAULT '[]',
  rating DOUBLE PRECISION,
  review_count INTEGER,
  photo_count INTEGER,
  post_count INTEGER,
  services_json JSONB DEFAULT '{}',
  attributes_json JSONB DEFAULT '{}',
  place_topics_json JSONB DEFAULT '[]',
  justifications_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Scan batches & points
CREATE TYPE scan_status AS ENUM (
  'draft', 'queued', 'dispatching', 'provider_running', 'normalizing',
  'enriching', 'scoring', 'ai_planning', 'ready', 'failed', 'partial', 'cancelled'
);

CREATE TABLE scan_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status scan_status NOT NULL DEFAULT 'draft',
  scan_type TEXT NOT NULL DEFAULT 'quick' CHECK (scan_type IN ('quick', 'standard')),
  grid_size INTEGER NOT NULL DEFAULT 5,
  radius_meters INTEGER NOT NULL DEFAULT 2000,
  device TEXT DEFAULT 'desktop',
  os TEXT DEFAULT 'windows',
  provider TEXT DEFAULT 'dataforseo',
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  confidence_summary JSONB DEFAULT '{}',
  aggregate_metrics JSONB DEFAULT '{}',
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_batches_business ON scan_batches(business_id);

CREATE TABLE scan_points (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_batch_id UUID NOT NULL REFERENCES scan_batches(id) ON DELETE CASCADE,
  grid_label TEXT NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  geom GEOGRAPHY(POINT, 4326),
  distance_from_center_m DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_points_batch ON scan_points(scan_batch_id);
CREATE INDEX idx_scan_points_geom ON scan_points USING GIST(geom);

CREATE TABLE scan_results (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_point_id UUID NOT NULL REFERENCES scan_points(id) ON DELETE CASCADE,
  keyword_id UUID NOT NULL REFERENCES business_keywords(id) ON DELETE CASCADE,
  target_rank INTEGER,
  target_found BOOLEAN NOT NULL DEFAULT false,
  check_url TEXT,
  source_timestamp TIMESTAMPTZ,
  confidence TEXT DEFAULT 'medium',
  top_competitors_json JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_scan_results_point ON scan_results(scan_point_id);

-- Audits
CREATE TYPE audit_status AS ENUM ('pending', 'running', 'ready', 'failed');

CREATE TABLE audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scan_batch_id UUID REFERENCES scan_batches(id) ON DELETE SET NULL,
  status audit_status NOT NULL DEFAULT 'pending',
  relevance_score DOUBLE PRECISION,
  distance_score DOUBLE PRECISION,
  prominence_score DOUBLE PRECISION,
  trust_score DOUBLE PRECISION,
  overall_score DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE audit_findings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  finding_type TEXT NOT NULL,
  bucket TEXT NOT NULL CHECK (bucket IN ('relevance', 'distance', 'prominence', 'trust')),
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  metric_key TEXT,
  metric_value TEXT,
  evidence_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_audit_findings_audit ON audit_findings(audit_id);

-- Action plans
CREATE TABLE action_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES audits(id) ON DELETE CASCADE,
  llm_model TEXT,
  summary TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'ready', 'failed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  action_plan_id UUID NOT NULL REFERENCES action_plans(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  bucket TEXT NOT NULL CHECK (bucket IN ('relevance', 'distance', 'prominence', 'trust')),
  impact TEXT CHECK (impact IN ('low', 'medium', 'high')),
  effort TEXT CHECK (effort IN ('low', 'medium', 'high')),
  priority_rank INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'skipped')),
  owner_user_id UUID,
  due_at TIMESTAMPTZ,
  evidence_json JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Provider runs (audit log)
CREATE TABLE provider_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  provider TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  request_hash TEXT,
  external_task_id TEXT,
  status_code INTEGER,
  latency_ms INTEGER,
  cost_estimate DOUBLE PRECISION,
  raw_request_json JSONB,
  raw_response_json JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_provider_runs_org ON provider_runs(organization_id);

-- Job queue
CREATE TABLE job_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_type TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 3,
  scheduled_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_job_queue_status ON job_queue(status, scheduled_at);

-- Google integrations
CREATE TABLE integrations_google (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  google_account_id TEXT,
  oauth_status TEXT DEFAULT 'disconnected',
  access_scopes JSONB DEFAULT '[]',
  tokens_json JSONB DEFAULT '{}',
  api_access_confirmed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Reports
CREATE TABLE reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  scan_batch_id UUID REFERENCES scan_batches(id) ON DELETE SET NULL,
  storage_path TEXT,
  share_token TEXT UNIQUE,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  metadata_json JSONB DEFAULT '{}'
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER businesses_updated_at BEFORE UPDATE ON businesses FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER scan_batches_updated_at BEFORE UPDATE ON scan_batches FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER action_items_updated_at BEFORE UPDATE ON action_items FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER audits_updated_at BEFORE UPDATE ON audits FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- RLS (policies use service role for MVP; tighten when Firebase auth lands)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
ALTER TABLE business_keywords ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_batches ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE scan_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_findings ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE provider_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE integrations_google ENABLE ROW LEVEL SECURITY;

-- Permissive policies for service role; anon blocked by default
CREATE POLICY "service_role_all" ON organizations FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON organization_members FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON businesses FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON business_keywords FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON scan_batches FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON scan_points FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON scan_results FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON audits FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON audit_findings FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON action_plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON action_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON provider_runs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON reports FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "service_role_all" ON integrations_google FOR ALL USING (true) WITH CHECK (true);
