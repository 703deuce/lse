-- Built-in campaign template provenance + success mode for stop-on-click.
ALTER TABLE review_request_campaigns
  ADD COLUMN IF NOT EXISTS source_template_id TEXT,
  ADD COLUMN IF NOT EXISTS source_template_version TEXT,
  ADD COLUMN IF NOT EXISTS success_mode TEXT NOT NULL DEFAULT 'click';

ALTER TABLE review_request_campaigns DROP CONSTRAINT IF EXISTS review_request_campaigns_success_mode_check;
ALTER TABLE review_request_campaigns ADD CONSTRAINT review_request_campaigns_success_mode_check
  CHECK (success_mode IN ('click', 'conservative', 'continue_until_confirmed'));

COMMENT ON COLUMN review_request_campaigns.source_template_id IS
  'Immutable system template id this campaign was copied from (null if custom).';
COMMENT ON COLUMN review_request_campaigns.source_template_version IS
  'System template version at copy time — campaigns are not retroactively updated.';
COMMENT ON COLUMN review_request_campaigns.success_mode IS
  'click = stop reminders after review-link click (default); conservative = matched review / reply / opt-out only; continue_until_confirmed = keep going after click until review matched.';
