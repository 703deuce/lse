-- 092: Drop legacy camelCase jobType column on production job_queue.
-- App inserts job_type (snake_case). When both exist, jobType NOT NULL fails:
--   null value in column "jobType" of relation "job_queue" violates not-null constraint

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'job_queue'
      AND column_name = 'jobType'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'job_queue'
        AND column_name = 'job_type'
    ) THEN
      UPDATE job_queue
      SET job_type = COALESCE(job_type, "jobType"::text)
      WHERE job_type IS NULL;
    END IF;

    ALTER TABLE job_queue DROP COLUMN "jobType";
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
