-- 091: Production job_queue may lack core columns from 001_initial_schema.
-- Fixes PostgREST PGRST204: Could not find the 'job_type' column of 'job_queue' in the schema cache
-- (enqueue on growth-audit, backlink-gap, trust, keywords, reputation, ai-visibility, etc.)

ALTER TABLE job_queue
  ADD COLUMN IF NOT EXISTS job_type TEXT,
  ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;

UPDATE job_queue
SET job_type = COALESCE(job_type, queue_name, 'legacy')
WHERE job_type IS NULL;

UPDATE job_queue
SET payload = '{}'::jsonb
WHERE payload IS NULL;

ALTER TABLE job_queue ALTER COLUMN payload SET DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM job_queue WHERE job_type IS NULL) THEN
    ALTER TABLE job_queue ALTER COLUMN job_type SET NOT NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM job_queue WHERE payload IS NULL) THEN
    ALTER TABLE job_queue ALTER COLUMN payload SET NOT NULL;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
