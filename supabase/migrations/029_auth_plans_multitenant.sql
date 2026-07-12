-- Multi-tenant plans, usage tracking, and org billing fields.
-- "organizations" = customer workspace / account silo.

CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  price_label TEXT,
  limits JSONB NOT NULL,
  features JSONB NOT NULL DEFAULT '{}',
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO plans (id, name, price_label, limits, features) VALUES
(
  'starter',
  'Starter',
  '$29/mo',
  '{
    "max_businesses": 1,
    "map_credits_month": 5000,
    "bulk_review_requests_month": 250,
    "sms_month": 0,
    "email_review_requests_month": 250,
    "local_trust_scans_month": 2,
    "backlink_gap_runs_month": 2,
    "growth_audits_month": 5,
    "ai_visibility_runs_month": 0,
    "users_seats": 1
  }'::jsonb,
  '{
    "rank_grid": true,
    "review_requests": true,
    "bulk_review_requests": true,
    "local_trust": true,
    "backlink_gap": true,
    "growth_audit": true,
    "review_momentum": true,
    "ai_visibility": false,
    "maps_keyword_difficulty_internal_only": false
  }'::jsonb
),
(
  'pro',
  'Pro',
  '$79/mo',
  '{
    "max_businesses": 1,
    "map_credits_month": 15000,
    "bulk_review_requests_month": 1000,
    "sms_month": 100,
    "email_review_requests_month": 1000,
    "local_trust_scans_month": 5,
    "backlink_gap_runs_month": 5,
    "growth_audits_month": 20,
    "ai_visibility_runs_month": 5,
    "users_seats": 3
  }'::jsonb,
  '{
    "rank_grid": true,
    "review_requests": true,
    "bulk_review_requests": true,
    "local_trust": true,
    "backlink_gap": true,
    "growth_audit": true,
    "review_momentum": true,
    "ai_visibility": true,
    "maps_keyword_difficulty_internal_only": false
  }'::jsonb
),
(
  'agency',
  'Agency',
  '$199/mo',
  '{
    "max_businesses": 10,
    "map_credits_month": 50000,
    "bulk_review_requests_month": 5000,
    "sms_month": 500,
    "email_review_requests_month": 5000,
    "local_trust_scans_month": 20,
    "backlink_gap_runs_month": 20,
    "growth_audits_month": 100,
    "ai_visibility_runs_month": 25,
    "users_seats": 10
  }'::jsonb,
  '{
    "rank_grid": true,
    "review_requests": true,
    "bulk_review_requests": true,
    "local_trust": true,
    "backlink_gap": true,
    "growth_audit": true,
    "review_momentum": true,
    "ai_visibility": true,
    "maps_keyword_difficulty_internal_only": false
  }'::jsonb
),
(
  'internal',
  'Internal',
  'Admin',
  '{
    "max_businesses": 9999,
    "map_credits_month": 999999,
    "bulk_review_requests_month": 999999,
    "sms_month": 999999,
    "email_review_requests_month": 999999,
    "local_trust_scans_month": 999999,
    "backlink_gap_runs_month": 999999,
    "growth_audits_month": 999999,
    "ai_visibility_runs_month": 999999,
    "users_seats": 999
  }'::jsonb,
  '{
    "rank_grid": true,
    "review_requests": true,
    "bulk_review_requests": true,
    "local_trust": true,
    "backlink_gap": true,
    "growth_audit": true,
    "review_momentum": true,
    "ai_visibility": true,
    "maps_keyword_difficulty_internal_only": true
  }'::jsonb
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  price_label = EXCLUDED.price_label,
  limits = EXCLUDED.limits,
  features = EXCLUDED.features;

ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS billing_status TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT;

UPDATE organizations SET plan = 'starter' WHERE plan IS NULL OR plan = 'free';

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON organizations(slug) WHERE slug IS NOT NULL;

CREATE TABLE IF NOT EXISTS organization_usage_monthly (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  map_credits_used INTEGER NOT NULL DEFAULT 0,
  growth_audits_used INTEGER NOT NULL DEFAULT 0,
  local_trust_scans_used INTEGER NOT NULL DEFAULT 0,
  backlink_gap_runs_used INTEGER NOT NULL DEFAULT 0,
  review_emails_sent INTEGER NOT NULL DEFAULT 0,
  review_sms_sent INTEGER NOT NULL DEFAULT 0,
  bulk_review_requests_used INTEGER NOT NULL DEFAULT 0,
  ai_visibility_runs_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period_start)
);

CREATE INDEX IF NOT EXISTS idx_org_usage_org_period ON organization_usage_monthly(organization_id, period_start);

-- RLS helper: organization membership check for authenticated users
CREATE OR REPLACE FUNCTION public.is_organization_member(org_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM organization_members
    WHERE organization_id = org_uuid
      AND user_id = auth.uid()
  );
$$;

-- Member-scoped policies (service role continues to bypass RLS)
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS org_members_select ON organizations;
CREATE POLICY org_members_select ON organizations
  FOR SELECT TO authenticated
  USING (is_organization_member(id));

DROP POLICY IF EXISTS org_members_select_members ON organization_members;
CREATE POLICY org_members_select_members ON organization_members
  FOR SELECT TO authenticated
  USING (is_organization_member(organization_id));

DROP POLICY IF EXISTS org_members_select_businesses ON businesses;
CREATE POLICY org_members_select_businesses ON businesses
  FOR SELECT TO authenticated
  USING (is_organization_member(organization_id));

DROP POLICY IF EXISTS org_members_insert_businesses ON businesses;
CREATE POLICY org_members_insert_businesses ON businesses
  FOR INSERT TO authenticated
  WITH CHECK (is_organization_member(organization_id));

DROP POLICY IF EXISTS org_members_update_businesses ON businesses;
CREATE POLICY org_members_update_businesses ON businesses
  FOR UPDATE TO authenticated
  USING (is_organization_member(organization_id))
  WITH CHECK (is_organization_member(organization_id));

ALTER TABLE organization_usage_monthly ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS org_members_select_usage ON organization_usage_monthly;
CREATE POLICY org_members_select_usage ON organization_usage_monthly
  FOR SELECT TO authenticated
  USING (is_organization_member(organization_id));
