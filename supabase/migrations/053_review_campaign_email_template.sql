-- Persist separate email template for both-channel review campaigns.

ALTER TABLE review_request_campaigns
  ADD COLUMN IF NOT EXISTS email_template_id UUID
    REFERENCES review_request_templates(id) ON DELETE SET NULL;
