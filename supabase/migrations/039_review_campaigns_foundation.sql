-- Review Campaigns foundation (Phase 1)
-- Extends existing review_request_* tables; does not create a parallel campaign system.

-- ---------------------------------------------------------------------------
-- Organization add-on entitlements (overrides / paid add-ons)
-- ---------------------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS addons JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN organizations.addons IS
  'Paid/feature add-ons e.g. {"review_campaigns":true,"review_campaigns_managed":false,"dedicated_messaging_number":false}';

-- ---------------------------------------------------------------------------
-- Campaign model extensions
-- ---------------------------------------------------------------------------
ALTER TABLE review_request_campaigns
  ADD COLUMN IF NOT EXISTS objective TEXT NOT NULL DEFAULT 'request_review',
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS sequence_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS channel_strategy TEXT NOT NULL DEFAULT 'both_same_time',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS auto_pause_reason TEXT,
  ADD COLUMN IF NOT EXISTS failed_reason TEXT,
  ADD COLUMN IF NOT EXISTS terms_acknowledged_at TIMESTAMPTZ;

-- Expand status check: keep existing 'cancelled' spelling; add failed + archived
ALTER TABLE review_request_campaigns DROP CONSTRAINT IF EXISTS review_request_campaigns_status_check;
ALTER TABLE review_request_campaigns ADD CONSTRAINT review_request_campaigns_status_check
  CHECK (
    status IN (
      'draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled', 'failed', 'archived'
    )
  );

ALTER TABLE review_request_campaigns DROP CONSTRAINT IF EXISTS review_request_campaigns_objective_check;
ALTER TABLE review_request_campaigns ADD CONSTRAINT review_request_campaigns_objective_check
  CHECK (
    objective IN (
      'request_review', 'reactivation', 'referral_request', 'service_reminder', 'promotional_offer'
    )
  );

ALTER TABLE review_request_campaigns DROP CONSTRAINT IF EXISTS review_request_campaigns_channel_strategy_check;
ALTER TABLE review_request_campaigns ADD CONSTRAINT review_request_campaigns_channel_strategy_check
  CHECK (
    channel_strategy IN (
      'sms_only', 'email_only', 'both_same_time', 'sms_then_email', 'email_then_sms', 'sequence'
    )
  );

-- ---------------------------------------------------------------------------
-- Contacts: normalization + CRM fields + tenant-safe uniqueness
-- ---------------------------------------------------------------------------
ALTER TABLE review_request_contacts
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS email_normalized TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS external_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_date DATE,
  ADD COLUMN IF NOT EXISTS last_service_date DATE,
  ADD COLUMN IF NOT EXISTS consent_state TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS consent_source TEXT,
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_unsubscribed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS campaign_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS latest_reply_snippet TEXT,
  ADD COLUMN IF NOT EXISTS review_completion TEXT NOT NULL DEFAULT 'unknown';

ALTER TABLE review_request_contacts DROP CONSTRAINT IF EXISTS review_request_contacts_consent_state_check;
ALTER TABLE review_request_contacts ADD CONSTRAINT review_request_contacts_consent_state_check
  CHECK (consent_state IN ('unknown', 'implied', 'express', 'revoked'));

ALTER TABLE review_request_contacts DROP CONSTRAINT IF EXISTS review_request_contacts_review_completion_check;
ALTER TABLE review_request_contacts ADD CONSTRAINT review_request_contacts_review_completion_check
  CHECK (review_completion IN ('unknown', 'likely', 'confirmed', 'none'));

-- Backfill normalized columns from legacy fields where possible
UPDATE review_request_contacts
SET email_normalized = lower(trim(customer_email))
WHERE customer_email IS NOT NULL
  AND (email_normalized IS NULL OR email_normalized = '');

UPDATE review_request_contacts
SET email_normalized = NULL
WHERE email_normalized IS NOT NULL AND trim(email_normalized) = '';

-- Collapse duplicate emails per business before unique indexes (legacy imports)
-- Prefer suppressed rows, then most recently updated. Full merge lives in 041 if needed.
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, email_normalized
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS rn
  FROM review_request_contacts
  WHERE email_normalized IS NOT NULL
)
UPDATE review_request_contacts c
SET email_normalized = NULL, updated_at = now()
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, phone_e164
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS rn
  FROM review_request_contacts
  WHERE phone_e164 IS NOT NULL
)
UPDATE review_request_contacts c
SET phone_e164 = NULL, updated_at = now()
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_contacts_business_phone_e164
  ON review_request_contacts(business_id, phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_contacts_business_email_norm
  ON review_request_contacts(business_id, email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_contacts_business_updated
  ON review_request_contacts(business_id, updated_at DESC);

-- ---------------------------------------------------------------------------
-- Upload job completeness
-- ---------------------------------------------------------------------------
ALTER TABLE review_request_uploads
  ADD COLUMN IF NOT EXISTS imported_rows INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_rows INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'completed',
  ADD COLUMN IF NOT EXISTS error_report_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS uploaded_by UUID,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT now(),
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

-- ---------------------------------------------------------------------------
-- Messages: idempotency + reply/review flags for sequences
-- ---------------------------------------------------------------------------
ALTER TABLE review_request_messages
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS step_key TEXT,
  ADD COLUMN IF NOT EXISTS segment_count INTEGER,
  ADD COLUMN IF NOT EXISTS provider_cost_cents NUMERIC,
  ADD COLUMN IF NOT EXISTS error_code TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_messages_idempotency
  ON review_request_messages(business_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_messages_provider_id
  ON review_request_messages(provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- Recipients: workflow state
ALTER TABLE review_request_recipients
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES review_request_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS current_step INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_action_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS workflow_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_detected_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS review_attribution TEXT;

ALTER TABLE review_request_recipients DROP CONSTRAINT IF EXISTS review_request_recipients_workflow_status_check;
ALTER TABLE review_request_recipients ADD CONSTRAINT review_request_recipients_workflow_status_check
  CHECK (
    workflow_status IN (
      'pending', 'scheduled', 'in_progress', 'waiting', 'completed', 'stopped', 'failed', 'opted_out'
    )
  );

-- ---------------------------------------------------------------------------
-- Sequence step definitions (versioned per campaign)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_campaign_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES review_request_campaigns(id) ON DELETE CASCADE,
  step_index INTEGER NOT NULL,
  step_key TEXT NOT NULL,
  step_type TEXT NOT NULL CHECK (
    step_type IN ('send_sms', 'send_email', 'wait', 'condition', 'end')
  ),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (campaign_id, step_index),
  UNIQUE (campaign_id, step_key)
);

CREATE INDEX IF NOT EXISTS idx_review_campaign_steps_campaign
  ON review_campaign_steps(campaign_id, step_index);

ALTER TABLE review_campaign_steps ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_campaign_steps' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON review_campaign_steps FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Honest review attribution events (never claim confirmed without evidence)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_campaign_attributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
  recipient_id UUID REFERENCES review_request_recipients(id) ON DELETE SET NULL,
  contact_id UUID REFERENCES review_request_contacts(id) ON DELETE SET NULL,
  review_id UUID,
  attribution_level TEXT NOT NULL CHECK (
    attribution_level IN ('confirmed', 'likely', 'unattributed')
  ),
  evidence_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_review_attr_business_detected
  ON review_campaign_attributions(business_id, detected_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_attr_unique_review_campaign
  ON review_campaign_attributions(business_id, campaign_id, review_id)
  WHERE review_id IS NOT NULL AND campaign_id IS NOT NULL;

ALTER TABLE review_campaign_attributions ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_campaign_attributions' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON review_campaign_attributions FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Review alert preferences
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  every_new_review BOOLEAN NOT NULL DEFAULT true,
  low_rating_only BOOLEAN NOT NULL DEFAULT false,
  unanswered_only BOOLEAN NOT NULL DEFAULT false,
  daily_summary BOOLEAN NOT NULL DEFAULT false,
  weekly_summary BOOLEAN NOT NULL DEFAULT false,
  email_recipients JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);

ALTER TABLE review_notification_settings ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_notification_settings' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON review_notification_settings FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- Idempotent notification log (avoid duplicate alerts)
CREATE TABLE IF NOT EXISTS review_notification_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_key TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, event_key)
);

ALTER TABLE review_notification_events ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_notification_events' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON review_notification_events FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;
