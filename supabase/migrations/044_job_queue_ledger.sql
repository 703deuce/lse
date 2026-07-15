-- Extend job_queue into a durable ledger for dual-driver queues (database + BullMQ).
-- Postgres remains the source of truth; Redis only coordinates execution when enabled.

ALTER TABLE job_queue
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS business_id UUID REFERENCES businesses(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS queue_name TEXT,
  ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT,
  ADD COLUMN IF NOT EXISTS progress_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enqueue_state TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS queue_job_id TEXT,
  ADD COLUMN IF NOT EXISTS cost_estimate NUMERIC,
  ADD COLUMN IF NOT EXISTS cost_actual NUMERIC,
  ADD COLUMN IF NOT EXISTS error_code TEXT,
  ADD COLUMN IF NOT EXISTS error_details JSONB;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'job_queue_enqueue_state_check'
  ) THEN
    ALTER TABLE job_queue
      ADD CONSTRAINT job_queue_enqueue_state_check
      CHECK (enqueue_state IN ('pending', 'enqueued', 'enqueue_failed', 'skipped'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_job_queue_idempotency
  ON job_queue (idempotency_key)
  WHERE idempotency_key IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_queue_org_status
  ON job_queue (organization_id, status, created_at DESC)
  WHERE organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_queue_queue_name
  ON job_queue (queue_name, status, scheduled_at)
  WHERE queue_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_job_queue_enqueue_failed
  ON job_queue (enqueue_state, created_at)
  WHERE enqueue_state = 'enqueue_failed';

COMMENT ON COLUMN job_queue.enqueue_state IS
  'Whether the ledger row was successfully handed to the execution driver (database cron or BullMQ)';
COMMENT ON COLUMN job_queue.queue_name IS
  'Logical queue: maps-scan, review-campaign, report-generation, etc.';
COMMENT ON COLUMN job_queue.idempotency_key IS
  'Stable key preventing duplicate equivalent work (e.g. maps-scan:<scanBatchId>)';
