-- Review Link / Review Request Kit (Reputation module)

CREATE TABLE review_request_links (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  place_id TEXT,
  review_url TEXT NOT NULL,
  short_url TEXT,
  qr_code_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX idx_review_request_links_active_business
  ON review_request_links(business_id)
  WHERE is_active = true;

CREATE INDEX idx_review_request_links_business ON review_request_links(business_id, created_at DESC);

CREATE TABLE review_request_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  channel TEXT NOT NULL CHECK (channel IN ('sms', 'email', 'print', 'generic')),
  name TEXT NOT NULL,
  subject TEXT,
  body TEXT NOT NULL,
  service_keyword_focus TEXT,
  tone TEXT NOT NULL DEFAULT 'friendly',
  is_default BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_request_templates_business ON review_request_templates(business_id, channel);

CREATE TABLE review_request_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  link_id UUID REFERENCES review_request_links(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (
    event_type IN ('copied', 'qr_downloaded', 'template_copied', 'manually_sent', 'completed')
  ),
  channel TEXT,
  customer_name TEXT,
  customer_phone TEXT,
  customer_email TEXT,
  service_type TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_request_events_business ON review_request_events(business_id, created_at DESC);
