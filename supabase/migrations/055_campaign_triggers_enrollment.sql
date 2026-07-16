-- Campaign triggers + shared enrollment provenance.
-- Manual / CSV / webhook / API all feed the same recipient enrollment model.

-- ---------------------------------------------------------------------------
-- Campaign definition: how customers enter + pause new enrollments separately
-- ---------------------------------------------------------------------------
ALTER TABLE review_request_campaigns
  ADD COLUMN IF NOT EXISTS trigger_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS enrollments_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_endpoint_id UUID;

ALTER TABLE review_request_campaigns DROP CONSTRAINT IF EXISTS review_request_campaigns_trigger_type_check;
ALTER TABLE review_request_campaigns ADD CONSTRAINT review_request_campaigns_trigger_type_check
  CHECK (trigger_type IN ('manual', 'webhook', 'api'));

COMMENT ON COLUMN review_request_campaigns.trigger_type IS
  'Primary entry path: manual (CSV/contacts/staff), webhook, or api. Future sources (zapier/make) map to api/webhook.';
COMMENT ON COLUMN review_request_campaigns.trigger_config IS
  'Trigger metadata e.g. {"eventType":"service.completed","endpointId":"...","allowManualEnrollment":true}';
COMMENT ON COLUMN review_request_campaigns.enrollments_paused IS
  'When true, block new enrollments but continue sending for already-active recipients.';

-- Optional FK to webhook endpoint (nullable — endpoint may also point at campaign).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'review_request_campaigns_webhook_endpoint_id_fkey'
  ) THEN
    ALTER TABLE review_request_campaigns
      ADD CONSTRAINT review_request_campaigns_webhook_endpoint_id_fkey
      FOREIGN KEY (webhook_endpoint_id)
      REFERENCES integration_webhook_endpoints(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL; -- endpoints table may not exist in partial envs
END $$;

-- ---------------------------------------------------------------------------
-- Campaign runs (manual launch waves / scheduled batches)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS review_campaign_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID NOT NULL REFERENCES review_request_campaigns(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'manual',
  status TEXT NOT NULL DEFAULT 'running',
  upload_id UUID REFERENCES review_request_uploads(id) ON DELETE SET NULL,
  scheduled_for TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  eligible_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT review_campaign_runs_source_check CHECK (
    source IN ('manual', 'csv', 'contacts', 'webhook', 'api', 'zapier', 'make', 'n8n', 'native_integration')
  ),
  CONSTRAINT review_campaign_runs_status_check CHECK (
    status IN ('draft', 'scheduled', 'running', 'completed', 'canceled')
  )
);

CREATE INDEX IF NOT EXISTS idx_review_campaign_runs_campaign
  ON review_campaign_runs(campaign_id, started_at DESC);

ALTER TABLE review_campaign_runs ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'review_campaign_runs' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON review_campaign_runs FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Recipient enrollment provenance
-- ---------------------------------------------------------------------------
ALTER TABLE review_request_recipients
  ADD COLUMN IF NOT EXISTS enrollment_source TEXT,
  ADD COLUMN IF NOT EXISTS source_event_id UUID,
  ADD COLUMN IF NOT EXISTS campaign_run_id UUID,
  ADD COLUMN IF NOT EXISTS enrolled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

ALTER TABLE review_request_recipients DROP CONSTRAINT IF EXISTS review_request_recipients_enrollment_source_check;
ALTER TABLE review_request_recipients ADD CONSTRAINT review_request_recipients_enrollment_source_check
  CHECK (
    enrollment_source IS NULL OR enrollment_source IN (
      'manual', 'csv', 'contacts', 'webhook', 'api', 'zapier', 'make', 'n8n', 'native_integration'
    )
  );

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'review_request_recipients_campaign_run_id_fkey'
  ) THEN
    ALTER TABLE review_request_recipients
      ADD CONSTRAINT review_request_recipients_campaign_run_id_fkey
      FOREIGN KEY (campaign_run_id)
      REFERENCES review_campaign_runs(id)
      ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'review_request_recipients_source_event_id_fkey'
  ) THEN
    ALTER TABLE review_request_recipients
      ADD CONSTRAINT review_request_recipients_source_event_id_fkey
      FOREIGN KEY (source_event_id)
      REFERENCES integration_webhook_events(id)
      ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN undefined_table THEN NULL;
END $$;

-- One enrollment per webhook event (idempotent retries).
CREATE UNIQUE INDEX IF NOT EXISTS idx_recipients_source_event_unique
  ON review_request_recipients(source_event_id)
  WHERE source_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recipients_campaign_run
  ON review_request_recipients(campaign_run_id)
  WHERE campaign_run_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_recipients_enrollment_source
  ON review_request_recipients(campaign_id, enrollment_source);
