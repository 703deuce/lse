-- ASVS L2: audit events, share token hashing.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS security_audit_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  actor_user_id UUID,
  actor_email TEXT,
  action TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  ip TEXT,
  user_agent TEXT,
  meta JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_security_audit_org_created
  ON security_audit_events (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_audit_action_created
  ON security_audit_events (action, created_at DESC);

ALTER TABLE security_audit_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'security_audit_events'
      AND policyname = 'org_members_select_security_audit'
  ) THEN
    CREATE POLICY org_members_select_security_audit ON security_audit_events
      FOR SELECT TO authenticated
      USING (
        organization_id IS NOT NULL
        AND is_organization_member(organization_id)
      );
  END IF;
END $$;

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS share_token_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_share_token_hash
  ON reports (share_token_hash)
  WHERE share_token_hash IS NOT NULL;

UPDATE reports
SET share_token_hash = encode(digest(share_token, 'sha256'), 'hex')
WHERE share_token IS NOT NULL
  AND (share_token_hash IS NULL OR share_token_hash = '');
