-- Close open USING(true) policies reintroduced after 035.
-- Service role bypasses RLS; authenticated keep member SELECT only.

ALTER TABLE IF EXISTS usage_ledger ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname = 'service_role_all'
        OR policyname LIKE 'service_role_all%'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Member SELECT policies for tables that still need browser reads.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'review_campaign_steps')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE tablename = 'review_campaign_steps' AND policyname = 'org_members_select_review_campaign_steps'
     ) THEN
    CREATE POLICY org_members_select_review_campaign_steps ON review_campaign_steps
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'review_campaign_attributions')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE tablename = 'review_campaign_attributions' AND policyname = 'org_members_select_review_campaign_attributions'
     ) THEN
    CREATE POLICY org_members_select_review_campaign_attributions ON review_campaign_attributions
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'review_notification_settings')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE tablename = 'review_notification_settings' AND policyname = 'org_members_select_review_notification_settings'
     ) THEN
    CREATE POLICY org_members_select_review_notification_settings ON review_notification_settings
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'review_notification_events')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE tablename = 'review_notification_events' AND policyname = 'org_members_select_review_notification_events'
     ) THEN
    CREATE POLICY org_members_select_review_notification_events ON review_notification_events
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feature_business_summaries')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE tablename = 'feature_business_summaries' AND policyname = 'org_members_select_feature_summaries'
     ) THEN
    CREATE POLICY org_members_select_feature_summaries ON feature_business_summaries
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'review_request_replies')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE tablename = 'review_request_replies' AND policyname = 'org_members_select_review_request_replies'
     ) THEN
    CREATE POLICY org_members_select_review_request_replies ON review_request_replies
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'organization_api_keys')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE tablename = 'organization_api_keys' AND policyname = 'org_members_select_api_keys'
     ) THEN
    CREATE POLICY org_members_select_api_keys ON organization_api_keys
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'review_campaign_runs')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE tablename = 'review_campaign_runs' AND policyname = 'org_members_select_review_campaign_runs'
     ) THEN
    CREATE POLICY org_members_select_review_campaign_runs ON review_campaign_runs
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'usage_ledger')
     AND NOT EXISTS (
       SELECT 1 FROM pg_policies
       WHERE tablename = 'usage_ledger' AND policyname = 'org_members_select_usage_ledger'
     ) THEN
    CREATE POLICY org_members_select_usage_ledger ON usage_ledger
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;
END $$;

-- provider_webhook_events is ops-only — no authenticated SELECT.
COMMENT ON TABLE provider_webhook_events IS
  'Provider webhook dedupe; service-role only (no open RLS policies).';

-- Prefer HMAC for new automation webhook endpoints.
ALTER TABLE IF EXISTS integration_webhook_endpoints
  ALTER COLUMN signature_required SET DEFAULT true;
