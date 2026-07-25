-- Text Messaging / Twilio A2P ISV onboarding (one subaccount per customer business)

CREATE TABLE IF NOT EXISTS messaging_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,

  -- Wizard / customer-facing state
  setup_step TEXT NOT NULL DEFAULT 'overview'
    CHECK (setup_step IN (
      'overview', 'business', 'use_case', 'review', 'status', 'number', 'ready'
    )),
  overall_status TEXT NOT NULL DEFAULT 'not_started'
    CHECK (overall_status IN (
      'not_started', 'action_required', 'submitted', 'in_review',
      'approved', 'failed', 'suspended', 'ready'
    )),

  -- Step statuses (customer-facing)
  business_details_status TEXT NOT NULL DEFAULT 'not_started',
  use_case_status TEXT NOT NULL DEFAULT 'not_started',
  brand_verification_status TEXT NOT NULL DEFAULT 'not_started',
  campaign_review_status TEXT NOT NULL DEFAULT 'not_started',
  number_status TEXT NOT NULL DEFAULT 'not_started',
  messaging_status TEXT NOT NULL DEFAULT 'not_started',

  -- Application payload (business profile)
  legal_business_name TEXT,
  dba_name TEXT,
  business_type TEXT,
  ein TEXT,
  registration_country TEXT DEFAULT 'US',
  business_industry TEXT,
  website_url TEXT,
  business_address_line1 TEXT,
  business_address_line2 TEXT,
  business_city TEXT,
  business_region TEXT,
  business_postal_code TEXT,
  regions_of_operation TEXT[] DEFAULT '{}',
  business_identity TEXT
    CHECK (business_identity IS NULL OR business_identity IN (
      'private', 'public', 'nonprofit', 'government', 'sole_proprietor'
    )),

  -- Authorized representative
  auth_rep_full_name TEXT,
  auth_rep_job_title TEXT,
  auth_rep_email TEXT,
  auth_rep_phone TEXT,
  auth_rep_role TEXT,

  -- Campaign / use case
  campaign_use_case TEXT DEFAULT 'CUSTOMER_CARE',
  campaign_description TEXT,
  opt_in_method TEXT,
  opt_in_language TEXT,
  consent_page_url TEXT,
  privacy_policy_url TEXT,
  terms_url TEXT,
  opt_out_wording TEXT DEFAULT 'Reply STOP to opt out.',
  help_wording TEXT DEFAULT 'Reply HELP for help.',
  expected_monthly_volume INT,
  messages_include_links BOOLEAN DEFAULT true,
  messages_include_phone_numbers BOOLEAN DEFAULT false,
  messaging_recurring BOOLEAN DEFAULT false,
  customer_can_initiate BOOLEAN DEFAULT false,
  restricted_content BOOLEAN DEFAULT false,
  sample_messages JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Certifications
  cert_authorized BOOLEAN DEFAULT false,
  cert_accurate BOOLEAN DEFAULT false,
  cert_understands_delays BOOLEAN DEFAULT false,
  submitted_at TIMESTAMPTZ,

  -- Brand contact verification
  brand_contact_email TEXT,
  brand_email_verification_status TEXT DEFAULT 'not_started',
  brand_type TEXT DEFAULT 'LOW_VOLUME',

  -- Twilio resource SIDs / statuses (blank until live adapter)
  twilio_subaccount_sid TEXT,
  twilio_customer_profile_sid TEXT,
  twilio_customer_profile_status TEXT,
  twilio_business_end_user_sid TEXT,
  twilio_authorized_rep_end_user_sid TEXT,
  twilio_address_sid TEXT,
  twilio_supporting_document_sid TEXT,
  twilio_profile_evaluation_status TEXT,
  twilio_profile_failure_reasons TEXT[] DEFAULT '{}',
  twilio_profile_submitted_at TIMESTAMPTZ,
  twilio_profile_approved_at TIMESTAMPTZ,

  twilio_brand_sid TEXT,
  twilio_brand_status TEXT,
  twilio_brand_failure_reason TEXT,
  twilio_brand_identity_status TEXT,

  twilio_campaign_sid TEXT,
  twilio_campaign_status TEXT,
  twilio_campaign_failure_reason TEXT,
  twilio_campaign_use_case TEXT,
  twilio_campaign_submitted_at TIMESTAMPTZ,
  twilio_campaign_approved_at TIMESTAMPTZ,

  twilio_messaging_service_sid TEXT,
  twilio_phone_number_sid TEXT,
  phone_number_e164 TEXT,
  phone_number_friendly TEXT,
  phone_number_locality TEXT,
  phone_number_region TEXT,
  phone_number_monthly_cost NUMERIC(10, 2),
  phone_number_capabilities JSONB NOT NULL DEFAULT '{}'::jsonb,
  phone_number_reserved BOOLEAN DEFAULT false,

  messaging_enabled BOOLEAN DEFAULT false,
  messaging_paused BOOLEAN DEFAULT false,
  monthly_sms_allowance INT DEFAULT 300,
  monthly_sms_used INT DEFAULT 0,

  adapter_mode TEXT NOT NULL DEFAULT 'mock'
    CHECK (adapter_mode IN ('mock', 'twilio')),
  last_status_checked_at TIMESTAMPTZ,
  last_error TEXT,
  admin_notes TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (business_id)
);

CREATE INDEX IF NOT EXISTS idx_messaging_registrations_org
  ON messaging_registrations (organization_id, overall_status);

CREATE INDEX IF NOT EXISTS idx_messaging_registrations_status
  ON messaging_registrations (overall_status, updated_at DESC);

CREATE TABLE IF NOT EXISTS messaging_registration_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  registration_id UUID NOT NULL REFERENCES messaging_registrations(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  event_type TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'system',
  message TEXT,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messaging_registration_events_reg
  ON messaging_registration_events (registration_id, created_at DESC);

ALTER TABLE messaging_registrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE messaging_registration_events ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'messaging_registrations'
      AND policyname = 'org_members_select_messaging_registrations'
  ) THEN
    CREATE POLICY org_members_select_messaging_registrations
      ON messaging_registrations FOR SELECT
      USING (public.is_organization_member(organization_id));
  END IF;
END $$;
