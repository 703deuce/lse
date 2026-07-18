-- Partial index for recovering scans.
-- Must run in a separate migration after 069 committed the new enum value
-- (PostgreSQL 55P04: unsafe use of new enum value in the same transaction).

CREATE INDEX IF NOT EXISTS idx_scan_batches_recovering_next
  ON scan_batches (next_recovery_at)
  WHERE status = 'recovering';
