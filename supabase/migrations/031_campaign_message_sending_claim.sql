-- Claim status for review_request_messages so dual pollers cannot double-send.

ALTER TABLE review_request_messages
  DROP CONSTRAINT IF EXISTS review_request_messages_status_check;

ALTER TABLE review_request_messages
  ADD CONSTRAINT review_request_messages_status_check
  CHECK (
    status IN (
      'queued',
      'sending',
      'sent',
      'delivered',
      'failed',
      'clicked',
      'opted_out',
      'skipped'
    )
  );

-- Speeds reclaim of workers that died mid-send.
CREATE INDEX IF NOT EXISTS idx_review_messages_sending_updated
  ON review_request_messages (updated_at)
  WHERE status = 'sending';
