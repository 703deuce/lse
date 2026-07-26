-- Live Twilio ISV fields: encrypted subaccount auth + Trust Product SIDs

ALTER TABLE messaging_registrations
  ADD COLUMN IF NOT EXISTS twilio_subaccount_auth_token_encrypted TEXT,
  ADD COLUMN IF NOT EXISTS twilio_subaccount_status TEXT,
  ADD COLUMN IF NOT EXISTS twilio_subaccount_created_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS twilio_profile_evaluation_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_rep_2_end_user_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_a2p_trust_product_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_a2p_end_user_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_a2p_evaluation_sid TEXT,
  ADD COLUMN IF NOT EXISTS twilio_a2p_trust_product_status TEXT,
  ADD COLUMN IF NOT EXISTS twilio_a2p_failure_reasons TEXT[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS twilio_brand_submitted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS twilio_brand_approved_at TIMESTAMPTZ;

COMMENT ON COLUMN messaging_registrations.twilio_subaccount_auth_token_encrypted IS
  'AES-GCM encrypted Twilio subaccount Auth Token. Never expose to the browser.';
