-- Automatic Review Triggers follow-ups:
-- ambiguous contact-match review queue + needs_review event status.

ALTER TABLE integration_webhook_events
  DROP CONSTRAINT IF EXISTS integration_webhook_events_status_check;

ALTER TABLE integration_webhook_events
  ADD CONSTRAINT integration_webhook_events_status_check
  CHECK (status IN (
    'received', 'validated', 'queued', 'processing', 'completed',
    'ignored_duplicate', 'ignored_suppressed', 'ignored_recently_requested',
    'ignored_test', 'rejected_invalid', 'rejected_unauthorized',
    'failed_retryable', 'failed_permanent', 'needs_review'
  ));

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

CREATE UNIQUE INDEX IF NOT EXISTS idx_webhook_contact_matches_event
  ON integration_webhook_contact_matches(event_id);

CREATE INDEX IF NOT EXISTS idx_webhook_contact_matches_org_pending
  ON integration_webhook_contact_matches(organization_id, business_id, created_at DESC)
  WHERE status = 'pending';

ALTER TABLE integration_webhook_contact_matches ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_webhook_contact_matches'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON integration_webhook_contact_matches
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_webhook_contact_matches'
      AND policyname = 'org_members_select_webhook_matches'
  ) THEN
    CREATE POLICY org_members_select_webhook_matches ON integration_webhook_contact_matches
      FOR SELECT USING (is_organization_member(organization_id));
  END IF;
END $$;
