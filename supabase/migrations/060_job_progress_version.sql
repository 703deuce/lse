-- Monotonic progress version for compact job-status polling / ETags.

ALTER TABLE job_queue
  ADD COLUMN IF NOT EXISTS progress_version INTEGER NOT NULL DEFAULT 0;

COMMENT ON COLUMN job_queue.progress_version IS
  'Monotonic counter bumped on each flushed progress/heartbeat-facing status write';

CREATE INDEX IF NOT EXISTS idx_job_queue_running_heartbeat
  ON job_queue (heartbeat_at)
  WHERE status = 'running';
