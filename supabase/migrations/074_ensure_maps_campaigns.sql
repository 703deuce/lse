-- Ensure maps_campaigns exists + baseline column.
-- Pull this file from master and run it in the Supabase SQL editor.
-- Idempotent: safe if 071/073 already applied.

CREATE TABLE IF NOT EXISTS maps_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses (id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  default_grid_size INTEGER NOT NULL DEFAULT 7,
  default_radius_meters INTEGER NOT NULL DEFAULT 3000,
  schedule_type TEXT NOT NULL DEFAULT 'manual',
  schedule_day INTEGER,
  schedule_timezone TEXT,
  next_scheduled_at TIMESTAMPTZ,
  schedule_enabled BOOLEAN NOT NULL DEFAULT false,
  archived_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT maps_campaigns_schedule_type_check
    CHECK (schedule_type IN ('manual', 'weekly', 'biweekly', 'monthly'))
);

CREATE INDEX IF NOT EXISTS idx_maps_campaigns_business
  ON maps_campaigns (business_id)
  WHERE archived_at IS NULL;

ALTER TABLE maps_campaigns ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'maps_campaigns' AND policyname = 'maps_campaigns_member_all'
  ) THEN
    CREATE POLICY maps_campaigns_member_all ON maps_campaigns
      FOR ALL
      USING (
        EXISTS (
          SELECT 1
          FROM businesses b
          WHERE b.id = maps_campaigns.business_id
            AND is_business_member(b.id)
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1
          FROM businesses b
          WHERE b.id = maps_campaigns.business_id
            AND is_business_member(b.id)
        )
      );
  END IF;
EXCEPTION
  WHEN undefined_function THEN
    RAISE NOTICE 'maps_campaigns created without RLS policy (is_business_member missing)';
END $$;

ALTER TABLE business_keywords
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES maps_campaigns (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_business_keywords_campaign
  ON business_keywords (campaign_id)
  WHERE campaign_id IS NOT NULL;

ALTER TABLE maps_campaigns
  ADD COLUMN IF NOT EXISTS baseline_scan_batch_id UUID REFERENCES scan_batches (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_maps_campaigns_baseline
  ON maps_campaigns (baseline_scan_batch_id)
  WHERE baseline_scan_batch_id IS NOT NULL;

COMMENT ON COLUMN maps_campaigns.baseline_scan_batch_id IS
  'Optional campaign baseline scan. Used for baseline-vs-current progress in reports.';
