-- Bulk review request campaigns (V1)

CREATE TABLE IF NOT EXISTS review_request_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (
    status IN ('draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled')
  ),
  channel TEXT NOT NULL DEFAULT 'both' CHECK (channel IN ('sms', 'email', 'both')),
  template_id UUID REFERENCES review_request_templates(id) ON DELETE SET NULL,
  daily_send_limit INTEGER NOT NULL DEFAULT 10,
  send_days JSONB NOT NULL DEFAULT '[1,2,3,4,5]'::jsonb,
  send_window_start TEXT NOT NULL DEFAULT '10:00',
  send_window_end TEXT NOT NULL DEFAULT '18:00',
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  duplicate_protection_days INTEGER NOT NULL DEFAULT 90,
  start_date DATE,
  consent_confirmed BOOLEAN NOT NULL DEFAULT false,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_campaigns_business
  ON review_request_campaigns(business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS review_request_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
  filename TEXT,
  total_rows INTEGER NOT NULL DEFAULT 0,
  valid_rows INTEGER NOT NULL DEFAULT 0,
  skipped_rows INTEGER NOT NULL DEFAULT 0,
  mapping_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS review_request_recipients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES review_request_campaigns(id) ON DELETE CASCADE,
  upload_id UUID REFERENCES review_request_uploads(id) ON DELETE SET NULL,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  phone TEXT,
  email TEXT,
  service_date TEXT,
  job_type TEXT,
  city TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'ready' CHECK (
    status IN (
      'ready', 'duplicate', 'invalid_contact', 'missing_contact',
      'recently_contacted', 'opted_out', 'skipped'
    )
  ),
  skip_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_recipients_campaign
  ON review_request_recipients(campaign_id, status);

CREATE TABLE IF NOT EXISTS review_request_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES review_request_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES review_request_recipients(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'sent', 'delivered', 'failed', 'clicked', 'opted_out', 'skipped')
  ),
  provider_message_id TEXT,
  tracking_token TEXT NOT NULL UNIQUE,
  tracking_url TEXT NOT NULL,
  google_review_url TEXT NOT NULL,
  subject TEXT,
  message_body TEXT,
  scheduled_for TIMESTAMPTZ NOT NULL,
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  failed_at TIMESTAMPTZ,
  failed_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_messages_scheduled
  ON review_request_messages(status, scheduled_for)
  WHERE status = 'queued';

CREATE INDEX IF NOT EXISTS idx_review_messages_campaign
  ON review_request_messages(campaign_id, status);

CREATE TABLE IF NOT EXISTS review_request_clicks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES review_request_campaigns(id) ON DELETE CASCADE,
  recipient_id UUID NOT NULL REFERENCES review_request_recipients(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES review_request_messages(id) ON DELETE CASCADE,
  tracking_token TEXT NOT NULL,
  clicked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_hash TEXT,
  user_agent TEXT
);

CREATE INDEX IF NOT EXISTS idx_review_clicks_token ON review_request_clicks(tracking_token);

CREATE TABLE IF NOT EXISTS review_request_suppression (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  phone TEXT,
  email TEXT,
  reason TEXT NOT NULL DEFAULT 'opt_out',
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_suppression_business
  ON review_request_suppression(business_id);

CREATE INDEX IF NOT EXISTS idx_review_suppression_phone
  ON review_request_suppression(business_id, phone)
  WHERE phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_suppression_email
  ON review_request_suppression(business_id, email)
  WHERE email IS NOT NULL;

ALTER TABLE review_request_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_request_uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_request_recipients ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_request_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_request_clicks ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_request_suppression ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'review_request_campaigns' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON review_request_campaigns FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'review_request_uploads' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON review_request_uploads FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'review_request_recipients' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON review_request_recipients FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'review_request_messages' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON review_request_messages FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'review_request_clicks' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON review_request_clicks FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'review_request_suppression' AND policyname = 'service_role_all') THEN
    CREATE POLICY service_role_all ON review_request_suppression FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
