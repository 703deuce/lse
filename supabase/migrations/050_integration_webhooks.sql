-- Production incoming webhooks for Automatic Review Triggers (Zapier / Make / n8n).

CREATE TABLE IF NOT EXISTS integration_webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  endpoint_token_hash TEXT NOT NULL,
  endpoint_token_last_four TEXT NOT NULL,
  previous_endpoint_token_hash TEXT,
  previous_token_expires_at TIMESTAMPTZ,
  signing_secret_encrypted TEXT,
  previous_signing_secret_encrypted TEXT,
  previous_signing_secret_expires_at TIMESTAMPTZ,
  signature_required BOOLEAN NOT NULL DEFAULT false,
  allowed_event_types JSONB NOT NULL DEFAULT '["service.completed","appointment.completed","invoice.paid","order.fulfilled","contact.enroll"]'::jsonb,
  default_event_type TEXT NOT NULL DEFAULT 'service.completed',
  default_campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
  default_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  contact_update_mode TEXT NOT NULL DEFAULT 'upsert'
    CHECK (contact_update_mode IN ('upsert', 'create_only', 'update_only', 'skip_existing')),
  duplicate_window_days INTEGER NOT NULL DEFAULT 90,
  send_delay_minutes INTEGER NOT NULL DEFAULT 0,
  timezone TEXT NOT NULL DEFAULT 'America/New_York',
  field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  require_email_consent BOOLEAN NOT NULL DEFAULT false,
  require_sms_consent BOOLEAN NOT NULL DEFAULT false,
  ip_allowlist JSONB NOT NULL DEFAULT '[]'::jsonb,
  tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_test BOOLEAN NOT NULL DEFAULT true,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  last_received_at TIMESTAMPTZ,
  last_success_at TIMESTAMPTZ,
  last_failure_at TIMESTAMPTZ,
  created_by_user_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_endpoints_token_hash
  ON integration_webhook_endpoints(endpoint_token_hash);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org
  ON integration_webhook_endpoints(organization_id, created_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_prev_token
  ON integration_webhook_endpoints(previous_endpoint_token_hash)
  WHERE previous_endpoint_token_hash IS NOT NULL;

CREATE TABLE IF NOT EXISTS integration_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  endpoint_id UUID NOT NULL REFERENCES integration_webhook_endpoints(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
  external_event_id TEXT,
  event_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  request_id TEXT NOT NULL,
  payload_schema_version INTEGER NOT NULL DEFAULT 1,
  payload_hash TEXT NOT NULL,
  payload_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  payload_normalized JSONB NOT NULL DEFAULT '{}'::jsonb,
  received_headers_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_ip_hash TEXT,
  status TEXT NOT NULL DEFAULT 'received'
    CHECK (status IN (
      'received', 'validated', 'queued', 'processing', 'completed',
      'ignored_duplicate', 'ignored_suppressed', 'ignored_recently_requested',
      'ignored_test', 'rejected_invalid', 'rejected_unauthorized',
      'failed_retryable', 'failed_permanent'
    )),
  processing_job_id UUID,
  contact_id UUID REFERENCES review_request_contacts(id) ON DELETE SET NULL,
  campaign_enrollment_id UUID REFERENCES review_request_recipients(id) ON DELETE SET NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ,
  error_code TEXT,
  customer_safe_error TEXT,
  internal_error TEXT,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_idempotency
  ON integration_webhook_events(endpoint_id, idempotency_key);

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_external
  ON integration_webhook_events(endpoint_id, external_event_id)
  WHERE external_event_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_events_endpoint_received
  ON integration_webhook_events(endpoint_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_org_received
  ON integration_webhook_events(organization_id, received_at DESC);

CREATE INDEX IF NOT EXISTS idx_webhook_events_status
  ON integration_webhook_events(status, received_at DESC)
  WHERE status IN ('queued', 'processing', 'failed_retryable');

ALTER TABLE integration_webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_webhook_endpoints' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON integration_webhook_endpoints
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_webhook_events' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON integration_webhook_events
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_webhook_endpoints' AND policyname = 'org_members_select_webhook_endpoints'
  ) THEN
    CREATE POLICY org_members_select_webhook_endpoints ON integration_webhook_endpoints
      FOR SELECT USING (is_organization_member(organization_id));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_webhook_events' AND policyname = 'org_members_select_webhook_events'
  ) THEN
    CREATE POLICY org_members_select_webhook_events ON integration_webhook_events
      FOR SELECT USING (is_organization_member(organization_id));
  END IF;
END $$;
