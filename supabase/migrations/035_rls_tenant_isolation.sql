-- Tenant isolation: drop open USING(true) policies and add member-scoped SELECT.
-- Service role continues to bypass RLS (Supabase); workers keep full access.
-- Authenticated browser clients get SELECT only on org/business-scoped rows.
-- Writes remain via service-role API routes / jobs.

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

CREATE OR REPLACE FUNCTION public.is_business_member(business_uuid UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM businesses b
    WHERE b.id = business_uuid
      AND is_organization_member(b.organization_id)
  );
$$;

REVOKE ALL ON FUNCTION public.is_organization_member(UUID) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_business_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_organization_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_business_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_organization_member(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.is_business_member(UUID) TO service_role;

-- Authenticated must not call confidence merge (no ownership check inside).
REVOKE EXECUTE ON FUNCTION public.merge_scan_confidence_summary(UUID, JSONB) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.merge_scan_confidence_summary(UUID, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.merge_scan_confidence_summary(UUID, JSONB) TO service_role;

-- ---------------------------------------------------------------------------
-- Drop open "service_role_all" policies (names vary; none are TO service_role)
-- ---------------------------------------------------------------------------
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE schemaname = 'public'
      AND (
        policyname IN ('service_role_all', 'service_role_all scan_batches')
        OR policyname LIKE 'service_role_all%'
        OR policyname = 'allow_all_authenticated'
      )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
  END LOOP;
END $$;

-- Also drop known quoted variants explicitly (idempotent)
DROP POLICY IF EXISTS "service_role_all" ON organizations;
DROP POLICY IF EXISTS "service_role_all" ON organization_members;
DROP POLICY IF EXISTS "service_role_all" ON businesses;
DROP POLICY IF EXISTS "service_role_all" ON business_keywords;
DROP POLICY IF EXISTS "service_role_all" ON scan_batches;
DROP POLICY IF EXISTS "service_role_all" ON scan_points;
DROP POLICY IF EXISTS "service_role_all" ON scan_results;
DROP POLICY IF EXISTS "service_role_all" ON audits;
DROP POLICY IF EXISTS "service_role_all" ON audit_findings;
DROP POLICY IF EXISTS "service_role_all" ON action_plans;
DROP POLICY IF EXISTS "service_role_all" ON action_items;
DROP POLICY IF EXISTS "service_role_all" ON provider_runs;
DROP POLICY IF EXISTS "service_role_all" ON reports;
DROP POLICY IF EXISTS "service_role_all" ON integrations_google;
DROP POLICY IF EXISTS "service_role_all" ON competitors;
DROP POLICY IF EXISTS "service_role_all" ON job_queue;
DROP POLICY IF EXISTS "service_role_all" ON profiles;
DROP POLICY IF EXISTS "service_role_all" ON scan_provider_tasks;
DROP POLICY IF EXISTS "service_role_all" ON scheduled_scans;

-- ---------------------------------------------------------------------------
-- Enable RLS on tables that previously lacked it
-- ---------------------------------------------------------------------------
ALTER TABLE IF EXISTS business_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_momentum_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_momentum_entities ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_momentum_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reputation_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reputation_competitors ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_keyword_gaps ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_response_drafts ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS reputation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_request_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_request_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_request_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS citation_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS citation_audits ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS citation_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS citation_missing ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS citation_competitor_presence ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS citation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS scan_cell_telemetry ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS review_sync_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS competitor_snapshots ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- Helper: create member SELECT policy if missing
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public._lse_ensure_member_select(
  p_table TEXT,
  p_policy TEXT,
  p_using TEXT
) RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  IF to_regclass('public.' || p_table) IS NULL THEN
    RETURN;
  END IF;
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = p_table AND policyname = p_policy
  ) THEN
    RETURN;
  END IF;
  EXECUTE format(
    'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (%s)',
    p_policy, p_table, p_using
  );
END;
$$;

-- Profiles: own row only
DO $$
BEGIN
  IF to_regclass('public.profiles') IS NOT NULL THEN
    DROP POLICY IF EXISTS profiles_select_own ON profiles;
    CREATE POLICY profiles_select_own ON profiles
      FOR SELECT TO authenticated
      USING (id = auth.uid());
    DROP POLICY IF EXISTS profiles_update_own ON profiles;
    CREATE POLICY profiles_update_own ON profiles
      FOR UPDATE TO authenticated
      USING (id = auth.uid())
      WITH CHECK (id = auth.uid());
  END IF;
END $$;

-- Org-scoped (organization_id)
SELECT public._lse_ensure_member_select('provider_runs', 'org_members_select_provider_runs', 'is_organization_member(organization_id)');
SELECT public._lse_ensure_member_select('integrations_google', 'org_members_select_integrations_google', 'is_organization_member(organization_id)');
SELECT public._lse_ensure_member_select('maps_difficulty_runs', 'org_members_select_maps_difficulty_runs', 'organization_id IS NOT NULL AND is_organization_member(organization_id)');
SELECT public._lse_ensure_member_select('business_reviews', 'org_members_select_business_reviews', 'is_organization_member(organization_id)');
SELECT public._lse_ensure_member_select('review_records', 'org_members_select_review_records', 'is_organization_member(organization_id)');
SELECT public._lse_ensure_member_select('reputation_competitors', 'org_members_select_reputation_competitors', 'is_organization_member(organization_id)');
SELECT public._lse_ensure_member_select('review_momentum_entities', 'org_members_select_review_momentum_entities', 'is_organization_member(organization_id)');
SELECT public._lse_ensure_member_select('review_sync_state', 'org_members_select_review_sync_state', 'is_organization_member(organization_id)');

-- Business-scoped (business_id)
SELECT public._lse_ensure_member_select('business_keywords', 'org_members_select_business_keywords', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('scan_batches', 'org_members_select_scan_batches', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('audits', 'org_members_select_audits', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('reports', 'org_members_select_reports', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('scheduled_scans', 'org_members_select_scheduled_scans', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('module_audits', 'org_members_select_module_audits', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('backlink_gap_runs', 'org_members_select_backlink_gap_runs', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('backlink_gap_opportunities', 'org_members_select_backlink_gap_opportunities', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('backlink_gap_tasks', 'org_members_select_backlink_gap_tasks', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('tracked_keywords', 'org_members_select_tracked_keywords', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('keyword_rank_checks', 'org_members_select_keyword_rank_checks', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('keyword_suggestions', 'org_members_select_keyword_suggestions', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('growth_audit_runs', 'org_members_select_growth_audit_runs', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('local_trust_runs', 'org_members_select_local_trust_runs', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('local_trust_opportunities', 'org_members_select_local_trust_opportunities', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('local_trust_tasks', 'org_members_select_local_trust_tasks', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('local_trust_candidates', 'org_members_select_local_trust_candidates', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('ai_visibility_prompts', 'org_members_select_ai_visibility_prompts', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('ai_visibility_runs', 'org_members_select_ai_visibility_runs', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('ai_visibility_engine_results', 'org_members_select_ai_visibility_engine_results', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('rank_locations', 'org_members_select_rank_locations', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('single_point_rank_checks', 'org_members_select_single_point_rank_checks', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_momentum_runs', 'org_members_select_review_momentum_runs', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_momentum_tasks', 'org_members_select_review_momentum_tasks', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('reputation_audits', 'org_members_select_reputation_audits', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_keyword_gaps', 'org_members_select_review_keyword_gaps', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_response_drafts', 'org_members_select_review_response_drafts', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('reputation_tasks', 'org_members_select_reputation_tasks', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_request_links', 'org_members_select_review_request_links', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_request_templates', 'org_members_select_review_request_templates', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_request_events', 'org_members_select_review_request_events', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_request_contacts', 'org_members_select_review_request_contacts', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_request_sends', 'org_members_select_review_request_sends', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_request_campaigns', 'org_members_select_review_request_campaigns', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_request_uploads', 'org_members_select_review_request_uploads', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_request_recipients', 'org_members_select_review_request_recipients', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_request_messages', 'org_members_select_review_request_messages', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_request_clicks', 'org_members_select_review_request_clicks', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('review_request_suppression', 'org_members_select_review_request_suppression', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('citation_audits', 'org_members_select_citation_audits', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('citation_listings', 'org_members_select_citation_listings', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('citation_missing', 'org_members_select_citation_missing', 'is_business_member(business_id)');
SELECT public._lse_ensure_member_select('citation_tasks', 'org_members_select_citation_tasks', 'is_business_member(business_id)');

-- Nested scan / audit children
SELECT public._lse_ensure_member_select(
  'scan_points',
  'org_members_select_scan_points',
  'EXISTS (SELECT 1 FROM scan_batches sb WHERE sb.id = scan_batch_id AND is_business_member(sb.business_id))'
);
SELECT public._lse_ensure_member_select(
  'scan_results',
  'org_members_select_scan_results',
  'EXISTS (
     SELECT 1 FROM scan_points sp
     JOIN scan_batches sb ON sb.id = sp.scan_batch_id
     WHERE sp.id = scan_point_id AND is_business_member(sb.business_id)
   )'
);
SELECT public._lse_ensure_member_select(
  'audit_findings',
  'org_members_select_audit_findings',
  'EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND is_business_member(a.business_id))'
);
SELECT public._lse_ensure_member_select(
  'action_plans',
  'org_members_select_action_plans',
  'EXISTS (SELECT 1 FROM audits a WHERE a.id = audit_id AND is_business_member(a.business_id))'
);
SELECT public._lse_ensure_member_select(
  'action_items',
  'org_members_select_action_items',
  'EXISTS (
     SELECT 1 FROM action_plans ap
     JOIN audits a ON a.id = ap.audit_id
     WHERE ap.id = action_plan_id AND is_business_member(a.business_id)
   )'
);
SELECT public._lse_ensure_member_select(
  'competitor_snapshots',
  'org_members_select_competitor_snapshots',
  'EXISTS (SELECT 1 FROM scan_batches sb WHERE sb.id = scan_batch_id AND is_business_member(sb.business_id))'
);
SELECT public._lse_ensure_member_select(
  'citation_competitor_presence',
  'org_members_select_citation_competitor_presence',
  'is_organization_member(organization_id)'
);

-- Citation catalog: readable by any authenticated member (shared lookup data)
SELECT public._lse_ensure_member_select('citation_sources', 'authenticated_select_citation_sources', 'auth.uid() IS NOT NULL');

-- System internals intentionally have no authenticated policies after dropping open ones:
-- job_queue, competitors, scan_provider_tasks, scan_workspace_cache, scan_cell_telemetry

DROP FUNCTION IF EXISTS public._lse_ensure_member_select(TEXT, TEXT, TEXT);
