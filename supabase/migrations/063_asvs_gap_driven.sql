-- ASVS gap-driven: append-only audit log, share password, immutable tenant keys.

REVOKE UPDATE, DELETE ON security_audit_events FROM authenticated;
REVOKE UPDATE, DELETE ON security_audit_events FROM anon;
REVOKE UPDATE, DELETE ON security_audit_events FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.deny_security_audit_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'security_audit_events is append-only';
END;
$$;

DROP TRIGGER IF EXISTS security_audit_events_no_update ON security_audit_events;
CREATE TRIGGER security_audit_events_no_update
  BEFORE UPDATE OR DELETE ON security_audit_events
  FOR EACH ROW
  EXECUTE FUNCTION public.deny_security_audit_mutation();

ALTER TABLE reports
  ADD COLUMN IF NOT EXISTS share_password_hash TEXT;

COMMENT ON COLUMN reports.share_password_hash IS
  'Optional password hash gating public share HTML; null = no password.';

CREATE OR REPLACE FUNCTION public.prevent_org_id_reassign()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
    RAISE EXCEPTION 'organization_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.prevent_business_id_reassign()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.business_id IS DISTINCT FROM OLD.business_id THEN
    RAISE EXCEPTION 'business_id is immutable';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS businesses_no_org_reassign ON businesses;
CREATE TRIGGER businesses_no_org_reassign
  BEFORE UPDATE ON businesses
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_org_id_reassign();

DROP TRIGGER IF EXISTS reports_no_business_reassign ON reports;
CREATE TRIGGER reports_no_business_reassign
  BEFORE UPDATE ON reports
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_id_reassign();

DROP TRIGGER IF EXISTS scan_batches_no_business_reassign ON scan_batches;
CREATE TRIGGER scan_batches_no_business_reassign
  BEFORE UPDATE ON scan_batches
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_business_id_reassign();
