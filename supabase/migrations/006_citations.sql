-- Citations module: audits, listings, missing opportunities, competitor presence, tasks

CREATE TABLE citation_sources (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  domain TEXT NOT NULL UNIQUE,
  source_type TEXT NOT NULL DEFAULT 'general',
  vertical TEXT NOT NULL DEFAULT 'all',
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  active BOOLEAN NOT NULL DEFAULT true,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE citation_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'running'
    CHECK (status IN ('running', 'ready', 'partial', 'failed')),
  vertical TEXT NOT NULL DEFAULT 'general',
  score INTEGER,
  found_count INTEGER NOT NULL DEFAULT 0,
  missing_count INTEGER NOT NULL DEFAULT 0,
  nap_issue_count INTEGER NOT NULL DEFAULT 0,
  competitor_gap_count INTEGER NOT NULL DEFAULT 0,
  ai_summary TEXT,
  progress_stage TEXT,
  warnings JSONB NOT NULL DEFAULT '[]',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at TIMESTAMPTZ,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_citation_audits_business ON citation_audits(business_id, created_at DESC);

CREATE TABLE citation_listings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES citation_audits(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_domain TEXT,
  listing_url TEXT,
  found BOOLEAN NOT NULL DEFAULT false,
  claimed_status TEXT,
  name_found TEXT,
  address_found TEXT,
  phone_found TEXT,
  website_found TEXT,
  expected_name TEXT,
  expected_address TEXT,
  expected_phone TEXT,
  expected_website TEXT,
  name_match_score NUMERIC,
  address_match_score NUMERIC,
  phone_match_score NUMERIC,
  website_match_score NUMERIC,
  nap_status TEXT NOT NULL DEFAULT 'unverified'
    CHECK (nap_status IN ('match', 'partial', 'mismatch', 'missing_data', 'unverified')),
  confidence TEXT NOT NULL DEFAULT 'low' CHECK (confidence IN ('high', 'medium', 'low')),
  raw_html_excerpt TEXT,
  raw_json JSONB NOT NULL DEFAULT '{}',
  checked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_citation_listings_audit ON citation_listings(audit_id);

CREATE TABLE citation_missing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES citation_audits(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  source_name TEXT NOT NULL,
  source_domain TEXT,
  priority TEXT NOT NULL DEFAULT 'medium' CHECK (priority IN ('high', 'medium', 'low')),
  reason TEXT,
  competitor_count INTEGER NOT NULL DEFAULT 0,
  suggested_search_url TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'done', 'skipped')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_citation_missing_audit ON citation_missing(audit_id);

CREATE TABLE citation_competitor_presence (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES citation_audits(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  competitor_id UUID REFERENCES competitors(id) ON DELETE SET NULL,
  competitor_name TEXT NOT NULL,
  source_name TEXT NOT NULL,
  source_domain TEXT,
  listed BOOLEAN NOT NULL DEFAULT false,
  listing_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_citation_competitor_presence_audit ON citation_competitor_presence(audit_id);

CREATE TABLE citation_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  audit_id UUID NOT NULL REFERENCES citation_audits(id) ON DELETE CASCADE,
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

CREATE INDEX idx_citation_tasks_audit ON citation_tasks(audit_id);
CREATE INDEX idx_citation_tasks_business ON citation_tasks(business_id, created_at DESC);

-- Seed citation sources
INSERT INTO citation_sources (name, domain, source_type, vertical, priority) VALUES
  ('Google Business Profile', 'google.com', 'maps', 'all', 'high'),
  ('Bing Places', 'bing.com', 'maps', 'all', 'high'),
  ('Apple Maps', 'apple.com', 'maps', 'all', 'high'),
  ('Yelp', 'yelp.com', 'general', 'all', 'high'),
  ('BBB', 'bbb.org', 'trust', 'all', 'high'),
  ('Facebook', 'facebook.com', 'social', 'all', 'high'),
  ('Nextdoor', 'nextdoor.com', 'social', 'all', 'high'),
  ('Chamber of Commerce', 'chamberofcommerce.com', 'trust', 'all', 'high'),
  ('Yellow Pages', 'yellowpages.com', 'general', 'all', 'high'),
  ('Angi', 'angi.com', 'home_services', 'home_services', 'high'),
  ('Thumbtack', 'thumbtack.com', 'home_services', 'home_services', 'high'),
  ('HomeAdvisor', 'homeadvisor.com', 'home_services', 'home_services', 'high'),
  ('Houzz', 'houzz.com', 'home_services', 'home_services', 'medium'),
  ('Porch', 'porch.com', 'home_services', 'home_services', 'medium'),
  ('BuildZoom', 'buildzoom.com', 'home_services', 'home_services', 'low'),
  ('GuildQuality', 'guildquality.com', 'home_services', 'home_services', 'low'),
  ('BestPickReports', 'bestpickreports.com', 'home_services', 'home_services', 'low'),
  ('MapQuest', 'mapquest.com', 'general', 'all', 'medium'),
  ('Foursquare', 'foursquare.com', 'general', 'all', 'medium'),
  ('Hotfrog', 'hotfrog.com', 'general', 'all', 'low'),
  ('Manta', 'manta.com', 'general', 'all', 'medium'),
  ('Local.com', 'local.com', 'general', 'all', 'low'),
  ('ShowMeLocal', 'showmelocal.com', 'general', 'all', 'low'),
  ('EZlocal', 'ezlocal.com', 'general', 'all', 'low'),
  ('Cylex', 'cylex.us', 'general', 'all', 'low'),
  ('Brownbook', 'brownbook.net', 'general', 'all', 'low'),
  ('MerchantCircle', 'merchantcircle.com', 'general', 'all', 'low'),
  ('Avvo', 'avvo.com', 'legal', 'legal', 'high'),
  ('Justia', 'justia.com', 'legal', 'legal', 'medium'),
  ('FindLaw', 'findlaw.com', 'legal', 'legal', 'medium'),
  ('Lawyers.com', 'lawyers.com', 'legal', 'legal', 'medium'),
  ('Martindale', 'martindale.com', 'legal', 'legal', 'medium'),
  ('Healthgrades', 'healthgrades.com', 'medical', 'medical', 'high'),
  ('Zocdoc', 'zocdoc.com', 'medical', 'medical', 'high'),
  ('WebMD', 'webmd.com', 'medical', 'medical', 'medium'),
  ('Vitals', 'vitals.com', 'medical', 'medical', 'medium')
ON CONFLICT (domain) DO NOTHING;
