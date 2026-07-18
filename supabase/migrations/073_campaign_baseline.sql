-- Campaign baseline scan for freelancer progress reporting.
-- When a prospect converts (or a freelancer marks a scan), reports can compare
-- baseline vs current / prior period vs current.
--
-- REQUIRES: 071_freelancer_accounts_campaigns.sql (creates maps_campaigns)
-- Apply order: 071 → 072 → 073

DO $$
BEGIN
  IF to_regclass('public.maps_campaigns') IS NULL THEN
    RAISE EXCEPTION
      'maps_campaigns does not exist. Apply supabase/migrations/071_freelancer_accounts_campaigns.sql first, then 072, then 073.';
  END IF;
END $$;

ALTER TABLE maps_campaigns
  ADD COLUMN IF NOT EXISTS baseline_scan_batch_id UUID REFERENCES scan_batches (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maps_campaigns_baseline
  ON maps_campaigns (baseline_scan_batch_id)
  WHERE baseline_scan_batch_id IS NOT NULL;

COMMENT ON COLUMN maps_campaigns.baseline_scan_batch_id IS
  'Optional campaign baseline scan. Used for baseline-vs-current progress in reports.';
