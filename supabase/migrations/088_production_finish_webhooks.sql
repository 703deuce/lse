-- 088: Finish production migration — rebuild stub webhook tables + remaining objects.
-- Safe when webhook tables are empty stubs (no real webhook data yet).
-- Run entire file in Supabase SQL editor, then: NOTIFY pgrst, 'reload schema';

-- =============================================================================
-- WEBHOOKS: drop broken empty stubs, recreate full schema
-- =============================================================================

DO $$
DECLARE
  n bigint;
BEGIN
  IF to_regclass('public.integration_webhook_contact_matches') IS NOT NULL THEN
    SELECT COUNT(*) INTO n FROM integration_webhook_contact_matches;
    IF n = 0 THEN
      DROP TABLE integration_webhook_contact_matches CASCADE;
    ELSIF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'integration_webhook_contact_matches' AND column_name = 'event_id'
    ) THEN
      RAISE EXCEPTION 'integration_webhook_contact_matches has rows but wrong schema — contact support';
    END IF;
  END IF;

  IF to_regclass('public.integration_webhook_events') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'integration_webhook_events' AND column_name = 'endpoint_id'
    ) THEN
      SELECT COUNT(*) INTO n FROM integration_webhook_events;
      IF n = 0 THEN
        DROP TABLE integration_webhook_events CASCADE;
      ELSE
        RAISE EXCEPTION 'integration_webhook_events has rows but missing endpoint_id — manual fix needed';
      END IF;
    END IF;
  END IF;

  IF to_regclass('public.integration_webhook_endpoints') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'integration_webhook_endpoints' AND column_name = 'endpoint_token_hash'
    ) THEN
      SELECT COUNT(*) INTO n FROM integration_webhook_endpoints;
      IF n = 0 THEN
        DROP TABLE integration_webhook_endpoints CASCADE;
      ELSE
        RAISE EXCEPTION 'integration_webhook_endpoints has rows but wrong schema — manual fix needed';
      END IF;
    END IF;
  END IF;
END $$;

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

-- If endpoints table existed with partial columns, add anything still missing
ALTER TABLE integration_webhook_endpoints
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS name TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS endpoint_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS endpoint_token_last_four TEXT,
  ADD COLUMN IF NOT EXISTS previous_endpoint_token_hash TEXT,
  ADD COLUMN IF NOT EXISTS previous_token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signing_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_signing_secret_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS previous_signing_secret_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS signature_required BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allowed_event_types JSONB NOT NULL DEFAULT '["service.completed","appointment.completed","invoice.paid","order.fulfilled","contact.enroll"]'::jsonb,
  ADD COLUMN IF NOT EXISTS default_event_type TEXT NOT NULL DEFAULT 'service.completed',
  ADD COLUMN IF NOT EXISTS default_campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS default_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS contact_update_mode TEXT NOT NULL DEFAULT 'upsert',
  ADD COLUMN IF NOT EXISTS duplicate_window_days INTEGER NOT NULL DEFAULT 90,
  ADD COLUMN IF NOT EXISTS send_delay_minutes INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS require_email_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS require_sms_consent BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ip_allowlist JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS is_test BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS rate_limit_per_minute INTEGER NOT NULL DEFAULT 60,
  ADD COLUMN IF NOT EXISTS last_received_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_success_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_failure_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

UPDATE integration_webhook_endpoints
SET endpoint_token_hash = 'legacy-migrate-' || id::text
WHERE endpoint_token_hash IS NULL;

UPDATE integration_webhook_endpoints
SET endpoint_token_last_four = '0000'
WHERE endpoint_token_last_four IS NULL;

UPDATE integration_webhook_endpoints
SET name = 'Legacy endpoint'
WHERE name IS NULL;

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
      'failed_retryable', 'failed_permanent', 'needs_review'
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

ALTER TABLE integration_webhook_events
  ADD COLUMN IF NOT EXISTS endpoint_id UUID REFERENCES integration_webhook_endpoints(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS external_event_id TEXT,
  ADD COLUMN IF NOT EXISTS event_type TEXT,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS request_id TEXT,
  ADD COLUMN IF NOT EXISTS payload_schema_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS payload_hash TEXT,
  ADD COLUMN IF NOT EXISTS payload_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS payload_normalized JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS received_headers_redacted JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS source_ip_hash TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'received',
  ADD COLUMN IF NOT EXISTS processing_job_id UUID,
  ADD COLUMN IF NOT EXISTS contact_id UUID REFERENCES review_request_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS campaign_enrollment_id UUID REFERENCES review_request_recipients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS processed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS customer_safe_error TEXT,
  ADD COLUMN IF NOT EXISTS internal_error TEXT,
  ADD COLUMN IF NOT EXISTS attempt_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE TABLE IF NOT EXISTS integration_webhook_contact_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  endpoint_id UUID NOT NULL REFERENCES integration_webhook_endpoints(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES integration_webhook_events(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'resolved_link', 'resolved_skip', 'dismissed')),
  reason TEXT NOT NULL,
  candidate_contact_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  incoming_external_id TEXT,
  incoming_email TEXT,
  incoming_phone TEXT,
  incoming_name TEXT,
  payload_normalized JSONB NOT NULL DEFAULT '{}'::jsonb,
  resolution_contact_id UUID REFERENCES review_request_contacts(id) ON DELETE SET NULL,
  resolved_by_user_id UUID,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE integration_webhook_contact_matches
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS endpoint_id UUID REFERENCES integration_webhook_endpoints(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES integration_webhook_events(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS reason TEXT,
  ADD COLUMN IF NOT EXISTS candidate_contact_ids JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS incoming_external_id TEXT,
  ADD COLUMN IF NOT EXISTS incoming_email TEXT,
  ADD COLUMN IF NOT EXISTS incoming_phone TEXT,
  ADD COLUMN IF NOT EXISTS incoming_name TEXT,
  ADD COLUMN IF NOT EXISTS payload_normalized JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS resolution_contact_id UUID REFERENCES review_request_contacts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS resolved_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_endpoints_token_hash
  ON integration_webhook_endpoints(endpoint_token_hash);

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org
  ON integration_webhook_endpoints(organization_id, created_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_prev_token
  ON integration_webhook_endpoints(previous_endpoint_token_hash)
  WHERE previous_endpoint_token_hash IS NOT NULL;

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_contact_matches_event
  ON integration_webhook_contact_matches(event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_contact_matches_org_pending
  ON integration_webhook_contact_matches(organization_id, business_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE integration_webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_contact_matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
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
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_webhook_contact_matches' AND policyname = 'org_members_select_webhook_matches'
  ) THEN
    CREATE POLICY org_members_select_webhook_matches ON integration_webhook_contact_matches
      FOR SELECT USING (is_organization_member(organization_id));
  END IF;
END $$;

-- Campaign trigger FK (055) — optional if campaigns use webhooks
ALTER TABLE review_request_campaigns
  ADD COLUMN IF NOT EXISTS trigger_type TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS trigger_config JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS enrollments_paused BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS webhook_endpoint_id UUID;

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
EXCEPTION WHEN undefined_table THEN NULL;
END $$;

-- =============================================================================
-- usage_ledger + feature_business_summaries (skip if already created)
-- =============================================================================

DO $$
DECLARE
  job_id_type TEXT;
  job_id_sql TEXT;
BEGIN
  SELECT c.data_type INTO job_id_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'job_queue' AND c.column_name = 'id';

  IF job_id_type = 'uuid' THEN
    job_id_sql := 'UUID REFERENCES job_queue(id) ON DELETE SET NULL';
  ELSE
    job_id_sql := 'TEXT REFERENCES job_queue(id) ON DELETE SET NULL';
  END IF;

  IF to_regclass('public.usage_ledger') IS NULL THEN
    EXECUTE format(
      'CREATE TABLE usage_ledger (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
        user_id UUID,
        job_id %s,
        feature TEXT NOT NULL,
        provider TEXT NOT NULL,
        unit_type TEXT NOT NULL,
        estimated_units NUMERIC,
        actual_units NUMERIC,
        estimated_cost_usd NUMERIC,
        actual_cost_usd NUMERIC,
        retry_cost_usd NUMERIC NOT NULL DEFAULT 0,
        billing_period TEXT,
        metadata JSONB NOT NULL DEFAULT ''{}''::jsonb,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )', job_id_sql
    );
  END IF;

  IF to_regclass('public.feature_business_summaries') IS NULL THEN
    EXECUTE format(
      'CREATE TABLE feature_business_summaries (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        feature TEXT NOT NULL,
        summary_json JSONB NOT NULL DEFAULT ''{}''::jsonb,
        version INTEGER NOT NULL DEFAULT 1,
        last_job_id %s,
        last_run_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (business_id, feature)
      )', job_id_sql
    );
  END IF;
END $$;

DO $$
BEGIN
  IF to_regclass('public.usage_ledger') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_usage_ledger_org_created ON usage_ledger (organization_id, created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_usage_ledger_job ON usage_ledger (job_id) WHERE job_id IS NOT NULL;
    CREATE INDEX IF NOT EXISTS idx_usage_ledger_feature_provider ON usage_ledger (feature, provider, created_at DESC);
  END IF;
  IF to_regclass('public.feature_business_summaries') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_feature_summaries_org_feature ON feature_business_summaries (organization_id, feature, updated_at DESC);
    CREATE INDEX IF NOT EXISTS idx_feature_summaries_business ON feature_business_summaries (business_id, updated_at DESC);
    ALTER TABLE feature_business_summaries ENABLE ROW LEVEL SECURITY;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'feature_business_summaries' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON feature_business_summaries
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- =============================================================================
-- prospect_audits
-- =============================================================================

CREATE TABLE IF NOT EXISTS prospect_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'running', 'ready', 'failed', 'shared')),
  keywords TEXT[] NOT NULL DEFAULT '{}',
  primary_keyword TEXT,
  growth_audit_run_id UUID,
  scan_batch_ids UUID[] NOT NULL DEFAULT '{}',
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  shared_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE prospect_audits
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS keywords TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS primary_keyword TEXT,
  ADD COLUMN IF NOT EXISTS growth_audit_run_id UUID,
  ADD COLUMN IF NOT EXISTS scan_batch_ids UUID[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS error_message TEXT,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS shared_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_prospect_audits_business_created ON prospect_audits (business_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prospect_audits_org_created ON prospect_audits (organization_id, created_at DESC);

ALTER TABLE prospect_audits ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'prospect_audits' AND policyname = 'prospect_audits_member_all'
  ) THEN
    CREATE POLICY prospect_audits_member_all ON prospect_audits
      FOR ALL
      USING (
        EXISTS (
          SELECT 1 FROM organization_members m
          WHERE m.organization_id = prospect_audits.organization_id AND m.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM organization_members m
          WHERE m.organization_id = prospect_audits.organization_id AND m.user_id = auth.uid()
        )
      );
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
