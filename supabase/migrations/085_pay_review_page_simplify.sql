-- Pay & Review Page: amount modes, Stripe provider, social links

-- Amount display mode (replaces wizard complexity around payment_mode for UX)
ALTER TABLE payment_page_configurations
  ADD COLUMN IF NOT EXISTS amount_mode TEXT NOT NULL DEFAULT 'none'
    CHECK (amount_mode IN ('none', 'custom', 'suggested'));

ALTER TABLE payment_page_configurations
  ADD COLUMN IF NOT EXISTS payment_note TEXT;

ALTER TABLE payment_page_configurations
  ADD COLUMN IF NOT EXISTS pinterest_url TEXT;

ALTER TABLE payment_page_configurations
  ADD COLUMN IF NOT EXISTS facebook_page_url TEXT;

ALTER TABLE payment_page_configurations
  ADD COLUMN IF NOT EXISTS booking_url TEXT;

-- Migrate existing rows to sensible amount modes
UPDATE payment_page_configurations c
SET amount_mode = CASE
  WHEN EXISTS (
    SELECT 1 FROM payment_page_suggested_amounts a
    WHERE a.payment_page_config_id = c.id AND a.enabled = true
  ) THEN 'suggested'
  WHEN c.allow_custom_amount = true THEN 'custom'
  ELSE 'none'
END
WHERE amount_mode = 'none' OR amount_mode IS NULL;

-- Allow Stripe Payment Link as a provider
ALTER TABLE payment_page_methods
  DROP CONSTRAINT IF EXISTS payment_page_methods_provider_check;

ALTER TABLE payment_page_methods
  ADD CONSTRAINT payment_page_methods_provider_check
  CHECK (provider IN ('stripe', 'venmo', 'cash_app', 'paypal', 'zelle'));
