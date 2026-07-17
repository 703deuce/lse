-- Multi-location slots by plan tier (app reads PLAN_DEFINITIONS in code;
-- keep plans.limits JSON in sync for ops / reporting).
-- Starter: 5 · Pro: 10 · Agency: 20 · Internal: unchanged (unlimited).

UPDATE plans
SET limits = jsonb_set(COALESCE(limits, '{}'::jsonb), '{max_businesses}', '5'::jsonb)
WHERE id = 'starter';

UPDATE plans
SET limits = jsonb_set(COALESCE(limits, '{}'::jsonb), '{max_businesses}', '10'::jsonb)
WHERE id = 'pro';

UPDATE plans
SET limits = jsonb_set(COALESCE(limits, '{}'::jsonb), '{max_businesses}', '20'::jsonb)
WHERE id = 'agency';
