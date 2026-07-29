-- Payment, Tip & Review QR — extends review_qr_campaigns

ALTER TABLE review_qr_campaigns
  ADD COLUMN IF NOT EXISTS campaign_type TEXT NOT NULL DEFAULT 'google_review'
    CHECK (campaign_type IN ('google_review', 'payment_review'));

ALTER TABLE review_qr_campaigns
  ADD COLUMN IF NOT EXISTS public_slug TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS review_qr_campaigns_public_slug_unique
  ON review_qr_campaigns (public_slug)
  WHERE public_slug IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_qr_campaigns_type
  ON review_qr_campaigns (business_id, campaign_type);

-- Payment page configuration (one per payment_review campaign)
CREATE TABLE IF NOT EXISTS payment_page_configurations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_campaign_id UUID NOT NULL UNIQUE REFERENCES review_qr_campaigns(id) ON DELETE CASCADE,
  purpose TEXT NOT NULL DEFAULT 'pay'
    CHECK (purpose IN ('pay', 'tip', 'donate', 'pay_invoice', 'leave_deposit', 'support_us', 'custom')),
  custom_purpose_label TEXT,
  title TEXT,
  description TEXT,
  thank_you_message TEXT,
  logo_url TEXT,
  banner_url TEXT,
  primary_color TEXT NOT NULL DEFAULT '#2563EB',
  secondary_color TEXT,
  allow_custom_amount BOOLEAN NOT NULL DEFAULT true,
  show_review_prompt BOOLEAN NOT NULL DEFAULT false,
  show_platform_branding BOOLEAN NOT NULL DEFAULT true,
  google_review_url TEXT,
  facebook_review_url TEXT,
  website_url TEXT,
  instagram_url TEXT,
  tiktok_url TEXT,
  youtube_url TEXT,
  phone TEXT,
  email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_page_config_campaign
  ON payment_page_configurations (qr_campaign_id);

CREATE TABLE IF NOT EXISTS payment_page_methods (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_page_config_id UUID NOT NULL REFERENCES payment_page_configurations(id) ON DELETE CASCADE,
  provider TEXT NOT NULL CHECK (provider IN ('venmo', 'cash_app', 'paypal', 'zelle')),
  public_handle TEXT,
  public_url TEXT,
  instructions TEXT,
  uploaded_qr_image_url TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_page_methods_unique_provider UNIQUE (payment_page_config_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_payment_page_methods_config
  ON payment_page_methods (payment_page_config_id, sort_order);

CREATE TABLE IF NOT EXISTS payment_page_suggested_amounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_page_config_id UUID NOT NULL REFERENCES payment_page_configurations(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  label TEXT,
  enabled BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_page_amounts_config
  ON payment_page_suggested_amounts (payment_page_config_id, sort_order);

-- Generalized QR campaign events (payment clicks, review clicks, page views)
CREATE TABLE IF NOT EXISTS review_qr_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES review_qr_campaigns(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  provider TEXT,
  amount_selected_cents INTEGER,
  session_id TEXT,
  user_agent TEXT,
  referrer TEXT,
  ip_hash TEXT,
  device_category TEXT,
  is_bot BOOLEAN NOT NULL DEFAULT false,
  is_preview BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_review_qr_events_campaign_type_time
  ON review_qr_events (campaign_id, event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_qr_events_campaign_time
  ON review_qr_events (campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_qr_events_session
  ON review_qr_events (campaign_id, session_id, event_type, created_at DESC)
  WHERE session_id IS NOT NULL;
