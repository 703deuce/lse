ALTER TABLE scan_batches ADD COLUMN IF NOT EXISTS browser TEXT DEFAULT 'chrome';

UPDATE scan_batches SET browser = 'chrome' WHERE browser IS NULL;

ALTER TABLE scan_results ADD COLUMN IF NOT EXISTS provider_request_json JSONB;
