-- Fix 071 keyword→campaign backfill (Postgres 42P10 on UPDATE … LATERAL).
-- Also re-applies the safe orphan-keyword attach if 071 rolled back mid-way.
-- Pull from master and run after 074 (or after maps_campaigns exists).

-- Ensure default campaign per business that has keywords without a campaign
INSERT INTO maps_campaigns (business_id, name, description)
SELECT
  bk.business_id,
  'Primary keywords',
  'Auto-created from existing keywords during freelancer Maps migration'
FROM business_keywords bk
WHERE NOT EXISTS (
  SELECT 1
  FROM maps_campaigns c
  WHERE c.business_id = bk.business_id
    AND c.archived_at IS NULL
)
GROUP BY bk.business_id;

-- Attach orphan keywords (no LATERAL on UPDATE target — avoids 42P10)
UPDATE business_keywords bk
SET campaign_id = c.id
FROM (
  SELECT DISTINCT ON (mc.business_id) mc.id, mc.business_id
  FROM maps_campaigns mc
  WHERE mc.archived_at IS NULL
  ORDER BY mc.business_id, mc.created_at ASC
) c
WHERE bk.campaign_id IS NULL
  AND bk.business_id = c.business_id;
