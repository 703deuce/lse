-- Freelancer Maps Phase 2–3: account CRM fields + Maps keyword campaigns.
-- Preserves all existing businesses, scans, and reports.
-- Does not rename businesses (FK/RLS blast radius).

-- ---------------------------------------------------------------------------
-- Account type / prospect pipeline on businesses
-- ---------------------------------------------------------------------------
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS account_type TEXT NOT NULL DEFAULT 'client',
  ADD COLUMN IF NOT EXISTS prospect_status TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_name TEXT,
  ADD COLUMN IF NOT EXISTS primary_contact_email TEXT,
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_account_type_check'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT businesses_account_type_check
      CHECK (account_type IN ('prospect', 'client'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'businesses_prospect_status_check'
  ) THEN
    ALTER TABLE businesses
      ADD CONSTRAINT businesses_prospect_status_check
      CHECK (
        prospect_status IS NULL
        OR prospect_status IN (
          'new',
          'contacted',
          'audit_sent',
          'proposal_sent',
          'won',
          'lost',
          'archived'
        )
      );
  END IF;
END $$;

COMMENT ON COLUMN businesses.account_type IS
  'Freelancer CRM: prospect (audit/outreach) or client (retained work).';
COMMENT ON COLUMN businesses.prospect_status IS
  'Sales pipeline for prospects only; null for clients.';
COMMENT ON COLUMN businesses.archived_at IS
  'Soft archive. Historical scans/reports remain. Distinct from is_tracked plan slots.';

-- Active tracked locations → clients
UPDATE businesses
SET
  account_type = 'client',
  prospect_status = NULL
WHERE COALESCE(is_tracked, true) = true
  AND archived_at IS NULL;

-- Untracked rows → prospects (manual audits / previously archived slots)
UPDATE businesses
SET
  account_type = 'prospect',
  prospect_status = COALESCE(prospect_status, 'new')
WHERE is_tracked = false
  AND archived_at IS NULL
  AND account_type = 'client';

CREATE INDEX IF NOT EXISTS idx_businesses_org_account_type
  ON businesses (organization_id, account_type)
  WHERE archived_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_businesses_org_archived
  ON businesses (organization_id)
  WHERE archived_at IS NOT NULL;

-- ---------------------------------------------------------------------------
-- Maps campaigns (keyword groups — not review-request campaigns)
-- ---------------------------------------------------------------------------
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
END $$;

ALTER TABLE business_keywords
  ADD COLUMN IF NOT EXISTS campaign_id UUID REFERENCES maps_campaigns (id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS active BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_business_keywords_campaign
  ON business_keywords (campaign_id)
  WHERE campaign_id IS NOT NULL;

-- Backfill one default campaign per business that has keywords without a campaign
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

-- Attach orphan keywords to an active campaign on the same business
UPDATE business_keywords bk
SET campaign_id = c.id
FROM LATERAL (
  SELECT id
  FROM maps_campaigns mc
  WHERE mc.business_id = bk.business_id
    AND mc.archived_at IS NULL
  ORDER BY mc.created_at ASC
  LIMIT 1
) c
WHERE bk.campaign_id IS NULL;

-- ---------------------------------------------------------------------------
-- In-app notification events (email can connect later)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations (id) ON DELETE CASCADE,
  user_id UUID,
  event_type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  href TEXT,
  entity_type TEXT,
  entity_id UUID,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_app_notifications_org_created
  ON app_notifications (organization_id, created_at DESC);

ALTER TABLE app_notifications ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'app_notifications' AND policyname = 'app_notifications_member_select'
  ) THEN
    CREATE POLICY app_notifications_member_select ON app_notifications
      FOR SELECT
      USING (
        EXISTS (
          SELECT 1 FROM organization_members m
          WHERE m.organization_id = app_notifications.organization_id
            AND m.user_id = auth.uid()
        )
      );
  END IF;
END $$;
