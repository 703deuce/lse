-- Per-organization API keys for Zapier / Make / custom automation webhooks.

CREATE TABLE IF NOT EXISTS organization_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE CASCADE,
  name TEXT NOT NULL DEFAULT 'Automation key',
  key_prefix TEXT NOT NULL,
  key_hash TEXT NOT NULL,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['automation']::text[],
  last_used_at TIMESTAMPTZ,
  revoked_at TIMESTAMPTZ,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_api_keys_hash
  ON organization_api_keys(key_hash);

CREATE INDEX IF NOT EXISTS idx_org_api_keys_org
  ON organization_api_keys(organization_id, created_at DESC)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_org_api_keys_prefix
  ON organization_api_keys(key_prefix);

ALTER TABLE organization_api_keys ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organization_api_keys'
      AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON organization_api_keys
      FOR ALL USING (true) WITH CHECK (true);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'organization_api_keys'
      AND policyname = 'org_members_select_api_keys'
  ) THEN
    CREATE POLICY org_members_select_api_keys ON organization_api_keys
      FOR SELECT
      USING (is_organization_member(organization_id));
  END IF;
END $$;
