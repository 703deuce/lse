-- Platform completion hardening (audit close-out).
-- Stripe checkout remains out of scope.

-- ---------------------------------------------------------------------------
-- Org outbound kill switch + business tracking mode
-- ---------------------------------------------------------------------------
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS outbound_paused BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN organizations.outbound_paused IS
  'When true, block all campaign/email/SMS enrollment and sending without disabling Maps.';

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS is_tracked BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS tracking_source TEXT NOT NULL DEFAULT 'manual';

COMMENT ON COLUMN businesses.is_tracked IS
  'Tracked businesses consume plan slots and get schedules/monitoring. Manual audits may be false.';
COMMENT ON COLUMN businesses.tracking_source IS
  'manual | gbp | import | convert — how the business entered tracking.';

-- ---------------------------------------------------------------------------
-- Provider webhook event dedupe (Twilio / Brevo)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS provider_webhook_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  provider TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_provider_webhook_events_idempotency
  ON provider_webhook_events (idempotency_key);

ALTER TABLE provider_webhook_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'provider_webhook_events' AND policyname = 'service_role_all'
  ) THEN
    CREATE POLICY service_role_all ON provider_webhook_events
      FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ---------------------------------------------------------------------------
-- Scheduled Maps: create scan_batches only — platform queue enqueues process_scan
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_due_scheduled_scans()
RETURNS INTEGER AS $$
DECLARE
  rec RECORD;
  new_batch_id UUID;
  count INTEGER := 0;
  v_keyword_id UUID;
  v_keyword_label TEXT;
  v_center_lat DOUBLE PRECISION;
  v_center_lng DOUBLE PRECISION;
  v_center_label TEXT;
  v_location_id UUID;
  v_conf JSONB;
BEGIN
  FOR rec IN
    SELECT ss.*
    FROM scheduled_scans ss
    JOIN businesses b ON b.id = ss.business_id
    JOIN organizations o ON o.id = b.organization_id
    WHERE ss.enabled = true
      AND COALESCE(b.is_tracked, true) = true
      AND COALESCE(o.status, 'active') = 'active'
      AND COALESCE(o.billing_status, 'manual') IN ('manual', 'active', 'trialing', 'ok')
      AND (ss.next_run_at IS NULL OR ss.next_run_at <= now())
    LIMIT 20
  LOOP
    SELECT bk.id, bk.keyword
      INTO v_keyword_id, v_keyword_label
    FROM business_keywords bk
    WHERE bk.business_id = rec.business_id
    ORDER BY bk.is_primary DESC, bk.created_at ASC
    LIMIT 1;

    SELECT sb.center_lat, sb.center_lng, sb.center_label, sb.location_id
      INTO v_center_lat, v_center_lng, v_center_label, v_location_id
    FROM scan_batches sb
    WHERE sb.business_id = rec.business_id
      AND sb.status IN ('ready', 'partial', 'rank_ready')
    ORDER BY sb.created_at DESC
    LIMIT 1;

    IF v_center_lat IS NULL OR v_center_lng IS NULL THEN
      SELECT COALESCE(b.scan_center_lat, b.lat),
             COALESCE(b.scan_center_lng, b.lng),
             b.address_text
        INTO v_center_lat, v_center_lng, v_center_label
      FROM businesses b
      WHERE b.id = rec.business_id;
    END IF;

    -- Skip if no usable center (avoid empty Bright Data burns).
    IF v_center_lat IS NULL OR v_center_lng IS NULL THEN
      UPDATE scheduled_scans
      SET next_run_at = now() + interval '1 day'
      WHERE id = rec.id;
      CONTINUE;
    END IF;

    v_conf := jsonb_build_object(
      'scheduled', true,
      'keyword_ids', CASE WHEN v_keyword_id IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(v_keyword_id) END,
      'keyword_label', v_keyword_label,
      'scheduled_scan_id', rec.id
    );

    INSERT INTO scan_batches (
      business_id, status, scan_type, grid_size, radius_meters,
      location_id, center_lat, center_lng, center_label, confidence_summary
    )
    VALUES (
      rec.business_id, 'queued', 'quick', rec.grid_size, rec.radius_meters,
      v_location_id, v_center_lat, v_center_lng, v_center_label, v_conf
    )
    RETURNING id INTO new_batch_id;

    -- Do NOT insert job_queue here — cron/TS discoverer uses enqueueMapsScanJob
    -- with organization_id, queue_name, and idempotency_key maps-scan:{batchId}.

    UPDATE scheduled_scans
    SET last_run_at = now(), next_run_at = now() + interval '7 days'
    WHERE id = rec.id;

    count := count + 1;
  END LOOP;
  RETURN count;
END;
$$ LANGUAGE plpgsql;
