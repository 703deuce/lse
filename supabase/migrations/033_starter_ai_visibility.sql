-- Enable AI Visibility on Starter so new signup / lowest plan can run checks.

UPDATE plans
SET
  limits = limits || '{"ai_visibility_runs_month": 5}'::jsonb,
  features = features || '{"ai_visibility": true}'::jsonb
WHERE id = 'starter';
