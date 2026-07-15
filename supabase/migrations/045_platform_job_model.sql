-- Platform-wide job model fields (Part 2).
-- Extends job_queue so every feature shares one lifecycle vocabulary.

ALTER TABLE job_queue
  ADD COLUMN IF NOT EXISTS parent_job_id UUID REFERENCES job_queue(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS related_resource_id TEXT,
  ADD COLUMN IF NOT EXISTS initiated_by_user_id UUID,
  ADD COLUMN IF NOT EXISTS input_schema_version INTEGER NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS progress_total INTEGER,
  ADD COLUMN IF NOT EXISTS progress_completed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS progress_failed INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS enqueued_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS lease_owner TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS worker_id TEXT,
  ADD COLUMN IF NOT EXISTS canceled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS error_class TEXT,
  ADD COLUMN IF NOT EXISTS customer_error TEXT,
  ADD COLUMN IF NOT EXISTS result_ref TEXT,
  ADD COLUMN IF NOT EXISTS lifecycle_status TEXT;

-- Align enqueue_state values with platform vocabulary (keep legacy values).
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_queue_enqueue_state_check'
  ) THEN
    ALTER TABLE job_queue DROP CONSTRAINT job_queue_enqueue_state_check;
  END IF;
  ALTER TABLE job_queue
    ADD CONSTRAINT job_queue_enqueue_state_check
    CHECK (enqueue_state IN (
      'pending', 'pending_enqueue', 'enqueued', 'enqueue_failed', 'skipped'
    ));
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_queue_lifecycle_status_check'
  ) THEN
    ALTER TABLE job_queue
      ADD CONSTRAINT job_queue_lifecycle_status_check
      CHECK (
        lifecycle_status IS NULL OR lifecycle_status IN (
          'created',
          'pending_enqueue',
          'queued',
          'running',
          'retrying',
          'paused',
          'completed',
          'canceled',
          'permanently_failed',
          'enqueue_failed',
          'dead_letter'
        )
      );
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_job_queue_lifecycle
  ON job_queue (lifecycle_status, scheduled_at)
  WHERE lifecycle_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_queue_parent
  ON job_queue (parent_job_id)
  WHERE parent_job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_queue_lease_expiry
  ON job_queue (lease_expires_at)
  WHERE lease_expires_at IS NOT NULL AND status = 'running';

CREATE INDEX IF NOT EXISTS idx_job_queue_org_queue_status
  ON job_queue (organization_id, queue_name, status, created_at DESC)
  WHERE organization_id IS NOT NULL;

-- Platform usage / cost ledger (Part 21)
CREATE TABLE IF NOT EXISTS usage_ledger (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  user_id UUID,
  job_id UUID REFERENCES job_queue(id) ON DELETE SET NULL,
  feature TEXT NOT NULL,
  provider TEXT NOT NULL,
  unit_type TEXT NOT NULL,
  estimated_units NUMERIC,
  actual_units NUMERIC,
  estimated_cost_usd NUMERIC,
  actual_cost_usd NUMERIC,
  retry_cost_usd NUMERIC NOT NULL DEFAULT 0,
  billing_period TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_org_created
  ON usage_ledger (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_usage_ledger_job
  ON usage_ledger (job_id)
  WHERE job_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_usage_ledger_feature_provider
  ON usage_ledger (feature, provider, created_at DESC);
