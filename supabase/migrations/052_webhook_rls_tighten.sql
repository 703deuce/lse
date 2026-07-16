-- Close open RLS policies on webhook tables (035 pattern: no USING(true) for all roles).
-- Service role bypasses RLS; authenticated members keep SELECT only.

DROP POLICY IF EXISTS service_role_all ON integration_webhook_endpoints;
DROP POLICY IF EXISTS service_role_all ON integration_webhook_events;
DROP POLICY IF EXISTS service_role_all ON integration_webhook_contact_matches;

-- Ensure member select policies exist (idempotent).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_webhook_endpoints'
      AND policyname = 'org_members_select_webhook_endpoints'
  ) THEN
    CREATE POLICY org_members_select_webhook_endpoints ON integration_webhook_endpoints
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_webhook_events'
      AND policyname = 'org_members_select_webhook_events'
  ) THEN
    CREATE POLICY org_members_select_webhook_events ON integration_webhook_events
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'integration_webhook_contact_matches'
      AND policyname = 'org_members_select_webhook_matches'
  ) THEN
    CREATE POLICY org_members_select_webhook_matches ON integration_webhook_contact_matches
      FOR SELECT TO authenticated
      USING (is_organization_member(organization_id));
  END IF;
END $$;
