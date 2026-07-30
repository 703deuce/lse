-- 093: Drop legacy Prisma/camelCase columns on job_queue when snake_case twins exist.
-- App inserts snake_case only. Production drift causes NOT NULL failures on camelCase
-- (e.g. jobType, updatedAt) after snake columns were added by platform migrations.

DO $$
DECLARE
  pair RECORD;
BEGIN
  FOR pair IN
    SELECT * FROM (VALUES
      ('createdAt', 'created_at'),
      ('updatedAt', 'updated_at'),
      ('organizationId', 'organization_id'),
      ('businessId', 'business_id'),
      ('parentJobId', 'parent_job_id'),
      ('relatedResourceId', 'related_resource_id'),
      ('initiatedByUserId', 'initiated_by_user_id'),
      ('queueName', 'queue_name'),
      ('idempotencyKey', 'idempotency_key'),
      ('maxAttempts', 'max_attempts'),
      ('scheduledAt', 'scheduled_at'),
      ('startedAt', 'started_at'),
      ('finishedAt', 'finished_at'),
      ('errorMessage', 'error_message'),
      ('enqueueState', 'enqueue_state'),
      ('queueJobId', 'queue_job_id'),
      ('costEstimate', 'cost_estimate'),
      ('costActual', 'cost_actual'),
      ('errorCode', 'error_code'),
      ('errorDetails', 'error_details'),
      ('progressJson', 'progress_json'),
      ('progressTotal', 'progress_total'),
      ('progressCompleted', 'progress_completed'),
      ('progressFailed', 'progress_failed'),
      ('enqueuedAt', 'enqueued_at'),
      ('leaseOwner', 'lease_owner'),
      ('leaseExpiresAt', 'lease_expires_at'),
      ('workerId', 'worker_id'),
      ('canceledAt', 'canceled_at'),
      ('errorClass', 'error_class'),
      ('customerError', 'customer_error'),
      ('resultRef', 'result_ref'),
      ('lifecycleStatus', 'lifecycle_status'),
      ('progressVersion', 'progress_version'),
      ('heartbeatAt', 'heartbeat_at'),
      ('jobType', 'job_type')
    ) AS t(camel, snake)
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'job_queue'
        AND column_name = pair.camel
    ) THEN
      IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'job_queue'
          AND column_name = pair.snake
      ) THEN
        EXECUTE format(
          'UPDATE job_queue SET %I = %I WHERE %I IS NULL AND %I IS NOT NULL',
          pair.snake,
          pair.camel,
          pair.snake,
          pair.camel
        );
        EXECUTE format('ALTER TABLE job_queue DROP COLUMN %I', pair.camel);
      ELSE
        EXECUTE format('ALTER TABLE job_queue RENAME COLUMN %I TO %I', pair.camel, pair.snake);
      END IF;
    END IF;
  END LOOP;
END $$;

ALTER TABLE job_queue
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

NOTIFY pgrst, 'reload schema';
