-- Review request sending: contacts, send log, extended events

CREATE TABLE IF NOT EXISTS review_request_contacts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  customer_name TEXT,
  customer_email TEXT,
  customer_phone TEXT,
  service_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_request_contacts_business
  ON review_request_contacts(business_id, created_at DESC);

CREATE TABLE IF NOT EXISTS review_request_sends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  contact_id UUID REFERENCES review_request_contacts(id) ON DELETE SET NULL,
  link_id UUID NOT NULL REFERENCES review_request_links(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('email', 'sms', 'manual')),
  recipient_email TEXT,
  recipient_phone TEXT,
  subject TEXT,
  message_body TEXT NOT NULL,
  review_url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued' CHECK (
    status IN ('queued', 'sent', 'failed', 'clicked', 'completed')
  ),
  provider TEXT CHECK (provider IN ('brevo', 'twilio', 'manual')),
  provider_message_id TEXT,
  error_message TEXT,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_request_sends_business
  ON review_request_sends(business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_review_request_sends_phone
  ON review_request_sends(recipient_phone, created_at DESC)
  WHERE recipient_phone IS NOT NULL;

ALTER TABLE review_request_events
  ADD COLUMN IF NOT EXISTS send_id UUID REFERENCES review_request_sends(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE review_request_events DROP CONSTRAINT IF EXISTS review_request_events_event_type_check;

ALTER TABLE review_request_events ADD CONSTRAINT review_request_events_event_type_check
  CHECK (
    event_type IN (
      'copied',
      'qr_downloaded',
      'template_copied',
      'manually_sent',
      'manual_sent',
      'completed',
      'email_sent',
      'sms_sent',
      'failed',
      'clicked',
      'reply_received'
    )
  );

ALTER TABLE review_request_contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_request_sends ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_request_contacts' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON review_request_contacts FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_request_sends' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON review_request_sends FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
