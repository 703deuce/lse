-- Freelancer Maps: share view tracking + assistant role + report publish status

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS share_view_count INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS share_last_viewed_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS publish_status TEXT NOT NULL DEFAULT 'published';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_publish_status_check'
  ) THEN
    ALTER TABLE reports
      ADD CONSTRAINT reports_publish_status_check
      CHECK (publish_status IN ('draft', 'published', 'archived'));
  END IF;
END $$;

COMMENT ON COLUMN reports.share_view_count IS 'Public share link view count (authenticated clients do not increment).';
COMMENT ON COLUMN reports.publish_status IS 'draft | published | archived — freelancer report lifecycle.';

-- Allow assistant as an alias role (maps to member permissions in app code).
-- Drop and recreate CHECK if present so assistant is accepted.
DO $$
DECLARE
  conname text;
BEGIN
  SELECT c.conname INTO conname
  FROM pg_constraint c
  JOIN pg_class t ON c.conrelid = t.oid
  WHERE t.relname = 'organization_members'
    AND c.contype = 'c'
    AND pg_get_constraintdef(c.oid) ILIKE '%role%';

  IF conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE organization_members DROP CONSTRAINT %I', conname);
  END IF;

  ALTER TABLE organization_members
    ADD CONSTRAINT organization_members_role_check
    CHECK (role IN ('owner', 'admin', 'member', 'assistant', 'readonly'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

COMMENT ON COLUMN organization_members.role IS
  'owner | admin | member | assistant | readonly. assistant ≈ member without billing/ownership.';
