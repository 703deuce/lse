-- Safe unique constraint on scan_results (scan_point_id, keyword_id)
-- Sequence: find duplicates → keep richest winner → delete losers → create unique index

-- 1) Report residual duplicates into notices (visible in migration logs)
DO $$
DECLARE
  dup_groups INTEGER;
  dup_rows INTEGER;
BEGIN
  SELECT COUNT(*), COALESCE(SUM(cnt - 1), 0)
  INTO dup_groups, dup_rows
  FROM (
    SELECT scan_point_id, keyword_id, COUNT(*) AS cnt
    FROM scan_results
    GROUP BY scan_point_id, keyword_id
    HAVING COUNT(*) > 1
  ) d;

  RAISE NOTICE 'scan_results duplicate groups=% extra_rows=% before cleanup', dup_groups, dup_rows;
END $$;

-- 2) Keep the richest row per (scan_point_id, keyword_id):
--    more competitors > target_found > newest created_at > lower id
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY scan_point_id, keyword_id
      ORDER BY
        COALESCE(jsonb_array_length(COALESCE(top_competitors_json, '[]'::jsonb)), 0) DESC,
        CASE WHEN target_found THEN 1 ELSE 0 END DESC,
        created_at DESC NULLS LAST,
        id ASC
    ) AS rn
  FROM scan_results
)
DELETE FROM scan_results sr
USING ranked r
WHERE sr.id = r.id
  AND r.rn > 1;

-- 3) Unique index (safe now that duplicates are gone)
CREATE UNIQUE INDEX IF NOT EXISTS idx_scan_results_point_keyword_unique
  ON scan_results (scan_point_id, keyword_id);

-- Keep existing lookup index useful for point-only queries
-- idx_scan_results_point already exists from 001_initial_schema.sql
