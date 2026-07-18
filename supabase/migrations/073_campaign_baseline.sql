-- Campaign baseline scan for freelancer progress reporting.
-- When a prospect converts (or a freelancer marks a scan), reports can compare
-- baseline vs current / prior period vs current.

ALTER TABLE maps_campaigns
  ADD COLUMN IF NOT EXISTS baseline_scan_batch_id UUID REFERENCES scan_batches (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maps_campaigns_baseline
  ON maps_campaigns (baseline_scan_batch_id)
  WHERE baseline_scan_batch_id IS NOT NULL;

COMMENT ON COLUMN maps_campaigns.baseline_scan_batch_id IS
  'Optional campaign baseline scan. Used for baseline-vs-current progress in reports.';
