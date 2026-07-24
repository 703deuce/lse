-- Phase 2: Reputation settings and review resolution metadata

ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'America/New_York',
  ADD COLUMN IF NOT EXISTS quiet_hours_start TIME,
  ADD COLUMN IF NOT EXISTS quiet_hours_end TIME,
  ADD COLUMN IF NOT EXISTS default_sender_name TEXT,
  ADD COLUMN IF NOT EXISTS default_sender_email TEXT,
  ADD COLUMN IF NOT EXISTS default_sender_phone TEXT,
  ADD COLUMN IF NOT EXISTS sms_compliance_status TEXT DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS email_sender_name TEXT,
  ADD COLUMN IF NOT EXISTS email_from_address TEXT,
  ADD COLUMN IF NOT EXISTS review_detection_match_days INT DEFAULT 14,
  ADD COLUMN IF NOT EXISTS review_detection_name_fuzzy BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS data_retention_days INT DEFAULT 730;

ALTER TABLE business_reviews
  ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS resolved_by UUID;
