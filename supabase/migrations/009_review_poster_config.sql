-- Poster customization for review request kit

ALTER TABLE review_request_links
  ADD COLUMN IF NOT EXISTS poster_config JSONB NOT NULL DEFAULT '{}';
