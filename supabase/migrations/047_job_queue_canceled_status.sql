-- Allow platform cancel vocabulary on the durable job ledger.
-- Previously cancel wrote status='canceled' which violated the original CHECK.

ALTER TABLE job_queue DROP CONSTRAINT IF EXISTS job_queue_status_check;

ALTER TABLE job_queue
  ADD CONSTRAINT job_queue_status_check
  CHECK (status IN ('pending', 'running', 'completed', 'failed', 'canceled', 'cancelled'));
