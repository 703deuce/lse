-- Prospect Audit: sales-facing audit package for freelancers pitching prospects.
CREATE TABLE IF NOT EXISTS prospect_audits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
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

CREATE INDEX IF NOT EXISTS idx_prospect_audits_business_created
  ON prospect_audits (business_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_prospect_audits_org_created
  ON prospect_audits (organization_id, created_at DESC);

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
          SELECT 1
          FROM organization_members m
          WHERE m.organization_id = prospect_audits.organization_id
            AND m.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM organization_members m
          WHERE m.organization_id = prospect_audits.organization_id
            AND m.user_id = auth.uid()
        )
      );
  END IF;
END $$;
