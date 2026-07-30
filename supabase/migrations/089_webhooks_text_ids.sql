-- 089: Webhook tables with TEXT primary keys (production drift: id columns are TEXT not UUID).
-- Run after 088 fails on endpoint_id FK type mismatch.
-- Drops EMPTY webhook tables only, then recreates with matching TEXT ids.

DO $$
DECLARE
  pk_type TEXT;
  n bigint;
BEGIN
  -- Detect existing PK type from endpoints or job_queue
  SELECT c.data_type INTO pk_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'integration_webhook_endpoints' AND c.column_name = 'id';

  IF pk_type IS NULL THEN
    SELECT c.data_type INTO pk_type
    FROM information_schema.columns c
    WHERE c.table_schema = 'public' AND c.table_name = 'job_queue' AND c.column_name = 'id';
  END IF;

  IF pk_type IS NULL OR pk_type = 'uuid' THEN
    pk_type := 'uuid';
  ELSE
    pk_type := 'text';
  END IF;

  -- Drop child tables first when empty
  IF to_regclass('public.integration_webhook_contact_matches') IS NOT NULL THEN
    SELECT COUNT(*) INTO n FROM integration_webhook_contact_matches;
    IF n = 0 THEN DROP TABLE integration_webhook_contact_matches CASCADE; END IF;
  END IF;

  IF to_regclass('public.integration_webhook_events') IS NOT NULL THEN
    SELECT COUNT(*) INTO n FROM integration_webhook_events;
    IF n = 0 THEN DROP TABLE integration_webhook_events CASCADE; END IF;
  END IF;

  IF to_regclass('public.integration_webhook_endpoints') IS NOT NULL THEN
    SELECT COUNT(*) INTO n FROM integration_webhook_endpoints;
    IF n = 0 THEN DROP TABLE integration_webhook_endpoints CASCADE; END IF;
  END IF;

  IF pk_type = 'uuid' THEN
    EXECUTE '
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
        allowed_event_types JSONB NOT NULL DEFAULT ''["service.completed","appointment.completed","invoice.paid","order.fulfilled","contact.enroll"]''::jsonb,
        default_event_type TEXT NOT NULL DEFAULT ''service.completed'',
        default_campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
        default_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
        contact_update_mode TEXT NOT NULL DEFAULT ''upsert'',
        duplicate_window_days INTEGER NOT NULL DEFAULT 90,
        send_delay_minutes INTEGER NOT NULL DEFAULT 0,
        timezone TEXT NOT NULL DEFAULT ''America/New_York'',
        field_mapping JSONB NOT NULL DEFAULT ''{}''::jsonb,
        require_email_consent BOOLEAN NOT NULL DEFAULT false,
        require_sms_consent BOOLEAN NOT NULL DEFAULT false,
        ip_allowlist JSONB NOT NULL DEFAULT ''[]''::jsonb,
        tags JSONB NOT NULL DEFAULT ''[]''::jsonb,
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
      )';
    EXECUTE '
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
        payload_redacted JSONB NOT NULL DEFAULT ''{}''::jsonb,
        payload_normalized JSONB NOT NULL DEFAULT ''{}''::jsonb,
        received_headers_redacted JSONB NOT NULL DEFAULT ''{}''::jsonb,
        source_ip_hash TEXT,
        status TEXT NOT NULL DEFAULT ''received'',
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
      )';
    EXECUTE '
      CREATE TABLE IF NOT EXISTS integration_webhook_contact_matches (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        endpoint_id UUID NOT NULL REFERENCES integration_webhook_endpoints(id) ON DELETE CASCADE,
        event_id UUID NOT NULL REFERENCES integration_webhook_events(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT ''pending'',
        reason TEXT NOT NULL,
        candidate_contact_ids JSONB NOT NULL DEFAULT ''[]''::jsonb,
        incoming_external_id TEXT,
        incoming_email TEXT,
        incoming_phone TEXT,
        incoming_name TEXT,
        payload_normalized JSONB NOT NULL DEFAULT ''{}''::jsonb,
        resolution_contact_id UUID REFERENCES review_request_contacts(id) ON DELETE SET NULL,
        resolved_by_user_id UUID,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )';
  ELSE
  -- TEXT primary keys (your production case)
    EXECUTE '
      CREATE TABLE IF NOT EXISTS integration_webhook_endpoints (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
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
        allowed_event_types JSONB NOT NULL DEFAULT ''["service.completed","appointment.completed","invoice.paid","order.fulfilled","contact.enroll"]''::jsonb,
        default_event_type TEXT NOT NULL DEFAULT ''service.completed'',
        default_campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
        default_business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
        contact_update_mode TEXT NOT NULL DEFAULT ''upsert'',
        duplicate_window_days INTEGER NOT NULL DEFAULT 90,
        send_delay_minutes INTEGER NOT NULL DEFAULT 0,
        timezone TEXT NOT NULL DEFAULT ''America/New_York'',
        field_mapping JSONB NOT NULL DEFAULT ''{}''::jsonb,
        require_email_consent BOOLEAN NOT NULL DEFAULT false,
        require_sms_consent BOOLEAN NOT NULL DEFAULT false,
        ip_allowlist JSONB NOT NULL DEFAULT ''[]''::jsonb,
        tags JSONB NOT NULL DEFAULT ''[]''::jsonb,
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
      )';
    EXECUTE '
      CREATE TABLE IF NOT EXISTS integration_webhook_events (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        endpoint_id TEXT NOT NULL REFERENCES integration_webhook_endpoints(id) ON DELETE CASCADE,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
        campaign_id UUID REFERENCES review_request_campaigns(id) ON DELETE SET NULL,
        external_event_id TEXT,
        event_type TEXT NOT NULL,
        idempotency_key TEXT NOT NULL,
        request_id TEXT NOT NULL,
        payload_schema_version INTEGER NOT NULL DEFAULT 1,
        payload_hash TEXT NOT NULL,
        payload_redacted JSONB NOT NULL DEFAULT ''{}''::jsonb,
        payload_normalized JSONB NOT NULL DEFAULT ''{}''::jsonb,
        received_headers_redacted JSONB NOT NULL DEFAULT ''{}''::jsonb,
        source_ip_hash TEXT,
        status TEXT NOT NULL DEFAULT ''received'',
        processing_job_id TEXT,
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
      )';
    EXECUTE '
      CREATE TABLE IF NOT EXISTS integration_webhook_contact_matches (
        id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
        organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
        business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
        endpoint_id TEXT NOT NULL REFERENCES integration_webhook_endpoints(id) ON DELETE CASCADE,
        event_id TEXT NOT NULL REFERENCES integration_webhook_events(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT ''pending'',
        reason TEXT NOT NULL,
        candidate_contact_ids JSONB NOT NULL DEFAULT ''[]''::jsonb,
        incoming_external_id TEXT,
        incoming_email TEXT,
        incoming_phone TEXT,
        incoming_name TEXT,
        payload_normalized JSONB NOT NULL DEFAULT ''{}''::jsonb,
        resolution_contact_id UUID REFERENCES review_request_contacts(id) ON DELETE SET NULL,
        resolved_by_user_id UUID,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      )';
  END IF;
END $$;

-- Indexes + RLS (idempotent)
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_endpoints_token_hash ON integration_webhook_endpoints(endpoint_token_hash);
CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_org ON integration_webhook_endpoints(organization_id, created_at DESC) WHERE revoked_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_events_idempotency ON integration_webhook_events(endpoint_id, idempotency_key);
CREATE INDEX IF NOT EXISTS idx_webhook_events_endpoint_received ON integration_webhook_events(endpoint_id, received_at DESC);
CREATE INDEX IF NOT EXISTS idx_webhook_events_org_received ON integration_webhook_events(organization_id, received_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_contact_matches_event ON integration_webhook_contact_matches(event_id);

ALTER TABLE integration_webhook_endpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE integration_webhook_contact_matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_webhook_endpoints' AND policyname = 'org_members_select_webhook_endpoints') THEN
    CREATE POLICY org_members_select_webhook_endpoints ON integration_webhook_endpoints FOR SELECT USING (is_organization_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_webhook_events' AND policyname = 'org_members_select_webhook_events') THEN
    CREATE POLICY org_members_select_webhook_events ON integration_webhook_events FOR SELECT USING (is_organization_member(organization_id));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'integration_webhook_contact_matches' AND policyname = 'org_members_select_webhook_matches') THEN
    CREATE POLICY org_members_select_webhook_matches ON integration_webhook_contact_matches FOR SELECT USING (is_organization_member(organization_id));
  END IF;
END $$;

-- Campaign webhook FK matches endpoints.id type
DO $$
DECLARE
  ep_id_type TEXT;
  col_type TEXT;
BEGIN
  SELECT c.data_type INTO ep_id_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'integration_webhook_endpoints' AND c.column_name = 'id';

  SELECT c.data_type INTO col_type
  FROM information_schema.columns c
  WHERE c.table_schema = 'public' AND c.table_name = 'review_request_campaigns' AND c.column_name = 'webhook_endpoint_id';

  IF col_type IS NULL THEN
    IF ep_id_type = 'text' THEN
      ALTER TABLE review_request_campaigns ADD COLUMN webhook_endpoint_id TEXT;
    ELSE
      ALTER TABLE review_request_campaigns ADD COLUMN webhook_endpoint_id UUID;
    END IF;
  ELSIF ep_id_type = 'text' AND col_type <> 'text' THEN
    ALTER TABLE review_request_campaigns ALTER COLUMN webhook_endpoint_id TYPE TEXT USING webhook_endpoint_id::text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'review_request_campaigns_webhook_endpoint_id_fkey'
  ) THEN
    ALTER TABLE review_request_campaigns ADD CONSTRAINT review_request_campaigns_webhook_endpoint_id_fkey
      FOREIGN KEY (webhook_endpoint_id) REFERENCES integration_webhook_endpoints(id) ON DELETE SET NULL;
  END IF;
EXCEPTION WHEN undefined_table OR undefined_column THEN NULL;
END $$;

NOTIFY pgrst, 'reload schema';
