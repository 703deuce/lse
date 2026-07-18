-- Persistent background recovery for Maps scans.
-- Adds recovering status, batch recovery scheduling fields, and per-point cell state.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_enum e
    JOIN pg_type t ON t.oid = e.enumtypid
    WHERE t.typname = 'scan_status'
      AND e.enumlabel = 'recovering'
  ) THEN
    ALTER TYPE scan_status ADD VALUE 'recovering';
  END IF;
END $$;

ALTER TABLE scan_batches
  ADD COLUMN IF NOT EXISTS recovery_generation INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS next_recovery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_recovery_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_locked_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS recovery_lock_owner TEXT,
  ADD COLUMN IF NOT EXISTS recovery_lease_expires_at TIMESTAMPTZ;

COMMENT ON COLUMN scan_batches.recovery_generation IS
  'Number of delayed background recovery jobs scheduled for this scan';
COMMENT ON COLUMN scan_batches.next_recovery_at IS
  'When the next delayed maps-cell-retry recovery job should run';
COMMENT ON COLUMN scan_batches.recovery_lock_owner IS
  'Worker id holding the recovery execution lease (separate from scan lease)';

-- NOTE: Do not create a partial index on status = 'recovering' in this file.
-- PostgreSQL requires the new enum value to be committed before it can be used
-- (error 55P04). See 070_scan_recovering_index.sql.

ALTER TABLE scan_points
  ADD COLUMN IF NOT EXISTS cell_status TEXT NOT NULL DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS total_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS capacity_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS actual_search_failures INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_error_category TEXT,
  ADD COLUMN IF NOT EXISTS last_error_message TEXT,
  ADD COLUMN IF NOT EXISTS first_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS next_retry_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

COMMENT ON COLUMN scan_points.cell_status IS
  'pending | running | retry_wait | complete | failed_permanent';

-- Deduplicate grid labels before unique index (keep oldest row per batch+label).
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY scan_batch_id, grid_label
      ORDER BY created_at ASC NULLS LAST, id ASC
    ) AS rn
  FROM scan_points
)
DELETE FROM scan_points sp
USING ranked r
WHERE sp.id = r.id
  AND r.rn > 1;

-- Logical identity of a grid cell within a batch (prevents duplicate point rows).
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_points_batch_grid_unique
  ON scan_points (scan_batch_id, grid_label);

CREATE INDEX IF NOT EXISTS idx_scan_points_batch_cell_status
  ON scan_points (scan_batch_id, cell_status);
