-- Scan batch leases for stuck-job reclaim / mid-scan resume.
-- Workers heartbeats lease_expires_at; stale in-flight batches can be reclaimed.

ALTER TABLE scan_batches
  ADD COLUMN IF NOT EXISTS lease_owner TEXT,
  ADD COLUMN IF NOT EXISTS lease_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS heartbeat_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_scan_batches_lease_reclaim
  ON scan_batches (status, lease_expires_at)
  WHERE status IN ('dispatching', 'provider_running');
