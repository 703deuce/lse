-- Purchase-anytime phone numbers: track purchase + Messaging Service attach state

ALTER TABLE messaging_registrations
  ADD COLUMN IF NOT EXISTS phone_number_purchased_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS twilio_phone_number_attached BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS twilio_phone_number_attached_at TIMESTAMPTZ;

COMMENT ON COLUMN messaging_registrations.phone_number_purchased_at IS
  'When the customer purchased the Twilio number (monthly rental begins).';
COMMENT ON COLUMN messaging_registrations.twilio_phone_number_attached IS
  'True once the PN… is in the Messaging Service sender pool.';
