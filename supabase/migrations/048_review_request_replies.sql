-- Durable inbound replies for review request campaigns + one-off sends.
-- Also completes delivery/click timestamps on quick-send rows.

CREATE TABLE IF NOT EXISTS review_request_replies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES review_request_recipients(id) ON DELETE SET NULL,
  message_id UUID REFERENCES review_request_messages(id) ON DELETE SET NULL,
  send_id UUID REFERENCES review_request_sends(id) ON DELETE SET NULL,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email')),
  body TEXT NOT NULL DEFAULT '',
  from_address TEXT,
  provider_sid TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_replies_campaign
  ON review_request_replies(campaign_id, created_at DESC)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_replies_recipient
  ON review_request_replies(recipient_id, created_at DESC)
  WHERE recipient_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_replies_business
  ON review_request_replies(business_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_replies_provider_sid
  ON review_request_replies(provider_sid)
  WHERE provider_sid IS NOT NULL;

ALTER TABLE review_request_sends
  ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS clicked_at TIMESTAMPTZ;

ALTER TABLE review_request_sends DROP CONSTRAINT IF EXISTS review_request_sends_status_check;
ALTER TABLE review_request_sends ADD CONSTRAINT review_request_sends_status_check
  CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'clicked', 'completed'));

CREATE INDEX IF NOT EXISTS idx_review_sends_provider_message_id
  ON review_request_sends(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

ALTER TABLE review_request_replies ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'review_request_replies'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON review_request_replies
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'review_request_replies'
      AND policyname = 'org_members_select_review_request_replies'
  ) THEN
    CREATE POLICY org_members_select_review_request_replies ON review_request_replies
      FOR SELECT
      USING (is_business_member(business_id));
  END IF;
END $$;
