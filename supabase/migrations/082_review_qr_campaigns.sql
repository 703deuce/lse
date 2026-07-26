-- Google Review QR Campaigns: tracked placements, scans, daily aggregates, claim tokens

CREATE TABLE IF NOT EXISTS review_qr_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  owner_user_id UUID,
  name TEXT NOT NULL DEFAULT 'Default QR Poster',
  placement_type TEXT NOT NULL DEFAULT 'standard_poster'
    CHECK (placement_type IN (
      'standard_poster', 'front_desk', 'counter_sign', 'table_tent', 'receipt_insert',
      'invoice', 'business_card', 'technician_leave_behind', 'company_vehicle',
      'window_sign', 'email_signature', 'custom'
    )),
  custom_placement_label TEXT,
  destination_url TEXT NOT NULL,
  short_code TEXT NOT NULL,
  headline TEXT NOT NULL DEFAULT 'Love our service?',
  description TEXT NOT NULL DEFAULT 'Scan to leave a quick Google review',
  brand_color TEXT NOT NULL DEFAULT '#16A34A',
  secondary_color TEXT,
  template_key TEXT NOT NULL DEFAULT 'classic_poster',
  print_format TEXT NOT NULL DEFAULT 'letter'
    CHECK (print_format IN ('a4', 'a5', 'letter', 'qr_only')),
  show_footer BOOLEAN NOT NULL DEFAULT true,
  poster_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'paused', 'draft', 'archived')),
  -- Anonymous ownership (public generator → claim after signup)
  anonymous_token_hash TEXT,
  anonymous_token_expires_at TIMESTAMPTZ,
  claimed_at TIMESTAMPTZ,
  source TEXT NOT NULL DEFAULT 'app'
    CHECK (source IN ('app', 'public', 'migrated')),
  migrated_from_link_id UUID REFERENCES review_request_links(id) ON DELETE SET NULL,
  total_scans INTEGER NOT NULL DEFAULT 0,
  estimated_unique_scans INTEGER NOT NULL DEFAULT 0,
  bot_scans INTEGER NOT NULL DEFAULT 0,
  last_scanned_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT review_qr_campaigns_short_code_unique UNIQUE (short_code)
);

CREATE INDEX IF NOT EXISTS idx_review_qr_campaigns_org
  ON review_qr_campaigns (organization_id);
CREATE INDEX IF NOT EXISTS idx_review_qr_campaigns_business
  ON review_qr_campaigns (business_id);
CREATE INDEX IF NOT EXISTS idx_review_qr_campaigns_status
  ON review_qr_campaigns (business_id, status);
CREATE INDEX IF NOT EXISTS idx_review_qr_campaigns_anon_hash
  ON review_qr_campaigns (anonymous_token_hash)
  WHERE anonymous_token_hash IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_qr_campaigns_anon_expires
  ON review_qr_campaigns (anonymous_token_expires_at)
  WHERE claimed_at IS NULL AND anonymous_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS review_qr_scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES review_qr_campaigns(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  scanned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_hash TEXT,
  user_agent TEXT,
  referrer TEXT,
  device_category TEXT,
  browser_category TEXT,
  os_category TEXT,
  country_code TEXT,
  region_code TEXT,
  visitor_id TEXT,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  counted BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_review_qr_scans_campaign_time
  ON review_qr_scans (campaign_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_qr_scans_business_time
  ON review_qr_scans (business_id, scanned_at DESC);
CREATE INDEX IF NOT EXISTS idx_review_qr_scans_unique_window
  ON review_qr_scans (campaign_id, ip_hash, scanned_at)
  WHERE counted = true AND is_bot = false;
CREATE INDEX IF NOT EXISTS idx_review_qr_scans_bots
  ON review_qr_scans (campaign_id, scanned_at DESC)
  WHERE is_bot = true OR is_preview = true;

CREATE TABLE IF NOT EXISTS review_qr_daily_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES review_qr_campaigns(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  stat_date DATE NOT NULL,
  total_scans INTEGER NOT NULL DEFAULT 0,
  estimated_unique_scans INTEGER NOT NULL DEFAULT 0,
  bot_scans INTEGER NOT NULL DEFAULT 0,
  mobile_scans INTEGER NOT NULL DEFAULT 0,
  desktop_scans INTEGER NOT NULL DEFAULT 0,
  tablet_scans INTEGER NOT NULL DEFAULT 0,
  other_scans INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT review_qr_daily_stats_unique UNIQUE (campaign_id, stat_date)
);

CREATE INDEX IF NOT EXISTS idx_review_qr_daily_stats_business_date
  ON review_qr_daily_stats (business_id, stat_date DESC);

CREATE TABLE IF NOT EXISTS review_qr_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES review_qr_campaigns(id) ON DELETE SET NULL,
  organization_id UUID,
  business_id UUID,
  actor_user_id UUID,
  event_type TEXT NOT NULL,
  message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_qr_audit_campaign
  ON review_qr_audit_events (campaign_id, created_at DESC);

COMMENT ON TABLE review_qr_campaigns IS
  'Printable Google review QR placements with first-party /r/{short_code} tracking.';
COMMENT ON COLUMN review_qr_campaigns.anonymous_token_hash IS
  'SHA-256 of single-use claim token for public-generator projects.';
COMMENT ON COLUMN review_qr_scans.ip_hash IS
  'HMAC hash of IP — raw IP is never stored.';
