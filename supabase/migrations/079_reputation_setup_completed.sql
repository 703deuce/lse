-- Track first-time reputation setup completion for lifecycle routing.
ALTER TABLE businesses
  ADD COLUMN IF NOT EXISTS reputation_setup_completed_at TIMESTAMPTZ;
