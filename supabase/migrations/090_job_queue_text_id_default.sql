-- 090: Ensure job_queue.id auto-generates when the column is TEXT (production drift).
-- Without a default, ledger inserts fail and every module Run button returns HTTP 500.

DO $$
DECLARE
  id_type TEXT;
  id_default TEXT;
BEGIN
  SELECT c.data_type, c.column_default
  INTO id_type, id_default
  FROM information_schema.columns c
  WHERE c.table_schema = 'public'
    AND c.table_name = 'job_queue'
    AND c.column_name = 'id';

  IF id_type = 'text' AND id_default IS NULL THEN
    ALTER TABLE job_queue
      ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
