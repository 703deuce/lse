-- Persist resolved Google Ads market for per-keyword volume targeting

ALTER TABLE tracked_keywords
  ADD COLUMN IF NOT EXISTS google_ads_location_code INTEGER;
