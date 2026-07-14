-- Safe confidence_summary merges + early enrichment claim column.
-- Writers should merge patches instead of read-modify-write whole JSON.

ALTER TABLE scan_batches
  ADD COLUMN IF NOT EXISTS early_enrichment_started BOOLEAN NOT NULL DEFAULT false;

UPDATE scan_batches
SET early_enrichment_started = true
WHERE early_enrichment_started = false
  AND COALESCE(confidence_summary->>'early_enrichment_started', 'false') IN ('true', 't', '1');

CREATE OR REPLACE FUNCTION merge_scan_confidence_summary(
  p_scan_id UUID,
  p_patch JSONB
)
RETURNS VOID
LANGUAGE sql
AS $$
  UPDATE scan_batches
  SET confidence_summary = COALESCE(confidence_summary, '{}'::jsonb) || COALESCE(p_patch, '{}'::jsonb)
  WHERE id = p_scan_id;
$$;

GRANT EXECUTE ON FUNCTION merge_scan_confidence_summary(UUID, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION merge_scan_confidence_summary(UUID, JSONB) TO authenticated;
