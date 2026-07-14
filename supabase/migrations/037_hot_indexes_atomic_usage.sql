-- Hot-path indexes, topical_fit column, atomic usage increment RPC.
-- (No CONCURRENTLY — Coolify/Supabase migrations typically run in a transaction.)

-- Dashboard / status scans by business + status
CREATE INDEX IF NOT EXISTS idx_scan_batches_business_status_created
  ON scan_batches (business_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_provider_runs_created
  ON provider_runs (created_at);

CREATE INDEX IF NOT EXISTS idx_job_queue_running_started
  ON job_queue (started_at)
  WHERE status = 'running';

CREATE INDEX IF NOT EXISTS idx_local_trust_opps_run_status_relevance
  ON local_trust_opportunities (run_id, status, relevance_score DESC);

CREATE INDEX IF NOT EXISTS idx_job_queue_finished
  ON job_queue (finished_at)
  WHERE status IN ('completed', 'failed');

-- Promote topical_fit out of raw_json for filterable list queries
ALTER TABLE backlink_gap_opportunities
  ADD COLUMN IF NOT EXISTS topical_fit TEXT;

UPDATE backlink_gap_opportunities
SET topical_fit = raw_json->>'topical_fit'
WHERE topical_fit IS NULL
  AND raw_json ? 'topical_fit';

CREATE INDEX IF NOT EXISTS idx_backlink_gap_opps_run_topical
  ON backlink_gap_opportunities (run_id, topical_fit)
  WHERE topical_fit IS NOT NULL;

-- Atomic usage reserve/commit (service_role + authenticated via SECURITY DEFINER).
-- Whitelisted columns only — p_usage_key is not concatenated unchecked.
CREATE OR REPLACE FUNCTION public.increment_org_usage(
  p_organization_id UUID,
  p_period_start DATE,
  p_period_end DATE,
  p_usage_key TEXT,
  p_amount INTEGER,
  p_limit INTEGER DEFAULT NULL
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  col TEXT;
  new_val INTEGER;
BEGIN
  IF p_amount IS NULL OR p_amount < 1 THEN
    RAISE EXCEPTION 'p_amount must be >= 1';
  END IF;

  col := CASE p_usage_key
    WHEN 'map_credits_used' THEN 'map_credits_used'
    WHEN 'growth_audits_used' THEN 'growth_audits_used'
    WHEN 'local_trust_scans_used' THEN 'local_trust_scans_used'
    WHEN 'backlink_gap_runs_used' THEN 'backlink_gap_runs_used'
    WHEN 'review_emails_sent' THEN 'review_emails_sent'
    WHEN 'review_sms_sent' THEN 'review_sms_sent'
    WHEN 'bulk_review_requests_used' THEN 'bulk_review_requests_used'
    WHEN 'ai_visibility_runs_used' THEN 'ai_visibility_runs_used'
    ELSE NULL
  END;

  IF col IS NULL THEN
    RAISE EXCEPTION 'invalid usage key: %', p_usage_key;
  END IF;

  INSERT INTO organization_usage_monthly (organization_id, period_start, period_end)
  VALUES (p_organization_id, p_period_start, p_period_end)
  ON CONFLICT (organization_id, period_start) DO NOTHING;

  EXECUTE format(
    'UPDATE organization_usage_monthly
     SET %I = %I + $1, updated_at = now()
     WHERE organization_id = $2
       AND period_start = $3
       AND ($4 IS NULL OR %I + $1 <= $4)
     RETURNING %I',
    col, col, col, col
  )
  INTO new_val
  USING p_amount, p_organization_id, p_period_start, p_limit;

  IF new_val IS NULL THEN
    RETURN -1;
  END IF;

  RETURN new_val;
END;
$$;

REVOKE ALL ON FUNCTION public.increment_org_usage(UUID, DATE, DATE, TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.increment_org_usage(UUID, DATE, DATE, TEXT, INTEGER, INTEGER) TO service_role;
