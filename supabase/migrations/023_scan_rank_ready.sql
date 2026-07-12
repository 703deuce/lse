-- Split scan lifecycle: rank_ready (map usable) then background enrichment

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e
    JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'scan_status' AND e.enumlabel = 'rank_ready'
  ) THEN
    ALTER TYPE scan_status ADD VALUE 'rank_ready';
  END IF;
END $$;

ALTER TABLE scan_batches
  ADD COLUMN IF NOT EXISTS rank_status TEXT,
  ADD COLUMN IF NOT EXISTS enrichment_status TEXT,
  ADD COLUMN IF NOT EXISTS cells_total INTEGER,
  ADD COLUMN IF NOT EXISTS cells_completed INTEGER,
  ADD COLUMN IF NOT EXISTS cells_failed INTEGER,
  ADD COLUMN IF NOT EXISTS rank_ready_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS enrichment_finished_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS ready_at TIMESTAMPTZ;
