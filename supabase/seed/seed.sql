-- Dev seed (run after 001 + 002 in SQL editor)
-- Creates a sample business keyword row only if a business exists

INSERT INTO scheduled_scans (business_id, cron_expression, enabled, next_run_at)
SELECT id, '0 9 * * 1', false, now() + interval '7 days'
FROM businesses
WHERE NOT EXISTS (
  SELECT 1 FROM scheduled_scans ss WHERE ss.business_id = businesses.id
)
LIMIT 1;
