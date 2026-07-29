-- Payment modes and transaction-specific payment request sessions

ALTER TABLE payment_page_configurations
  ADD COLUMN IF NOT EXISTS payment_mode TEXT NOT NULL DEFAULT 'reusable_page'
    CHECK (payment_mode IN ('reusable_page', 'request_only'));

CREATE TABLE IF NOT EXISTS payment_request_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qr_campaign_id UUID NOT NULL REFERENCES review_qr_campaigns(id) ON DELETE CASCADE,
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  short_code TEXT NOT NULL,
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  currency TEXT NOT NULL DEFAULT 'USD',
  note TEXT,
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'expired', 'cancelled')),
  expires_at TIMESTAMPTZ,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT payment_request_sessions_short_code_unique UNIQUE (short_code)
);

CREATE INDEX IF NOT EXISTS idx_payment_request_sessions_campaign
  ON payment_request_sessions (qr_campaign_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_request_sessions_business
  ON payment_request_sessions (business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payment_request_sessions_short_code
  ON payment_request_sessions (short_code)
  WHERE status = 'active';

-- Link events to a specific payment request when applicable
ALTER TABLE review_qr_events
  ADD COLUMN IF NOT EXISTS payment_request_session_id UUID
    REFERENCES payment_request_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_review_qr_events_payment_request
  ON review_qr_events (payment_request_session_id, created_at DESC)
  WHERE payment_request_session_id IS NOT NULL;
