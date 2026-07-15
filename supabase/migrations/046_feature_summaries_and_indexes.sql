-- Phase 4: durable feature summaries + hot-path indexes for platform scale.

CREATE TABLE IF NOT EXISTS feature_business_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  summary_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  version INTEGER NOT NULL DEFAULT 1,
  last_job_id UUID REFERENCES job_queue(id) ON DELETE SET NULL,
  last_run_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id, feature)
);

CREATE INDEX IF NOT EXISTS idx_feature_summaries_org_feature
  ON feature_business_summaries (organization_id, feature, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_feature_summaries_business
  ON feature_business_summaries (business_id, updated_at DESC);

ALTER TABLE feature_business_summaries ENABLE ROW LEVEL SECURITY;

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

-- Hot job claim / recovery indexes
CREATE INDEX IF NOT EXISTS idx_job_queue_due_pending
  ON job_queue (status, scheduled_at, priority)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_job_queue_org_type_created
  ON job_queue (organization_id, job_type, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- Feature run list indexes (only when tables exist)
DO $$
BEGIN
  IF to_regclass('public.scan_batches') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_scan_batches_business_created
      ON scan_batches (business_id, created_at DESC);
  END IF;
  IF to_regclass('public.backlink_gap_runs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_backlink_gap_runs_business_created
      ON backlink_gap_runs (business_id, created_at DESC);
  END IF;
  IF to_regclass('public.local_trust_runs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_local_trust_runs_business_created
      ON local_trust_runs (business_id, created_at DESC);
  END IF;
  IF to_regclass('public.ai_visibility_runs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_ai_visibility_runs_business_created
      ON ai_visibility_runs (business_id, created_at DESC);
  END IF;
  IF to_regclass('public.growth_audit_runs') IS NOT NULL THEN
    CREATE INDEX IF NOT EXISTS idx_growth_audit_runs_business_created
      ON growth_audit_runs (business_id, created_at DESC);
  END IF;
END $$;
