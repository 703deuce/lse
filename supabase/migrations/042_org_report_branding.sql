-- White-label branding for client-facing reports (logo, accent, footer).
ALTER TABLE organizations
  ADD COLUMN IF NOT EXISTS report_logo_url TEXT,
  ADD COLUMN IF NOT EXISTS report_accent_color TEXT,
  ADD COLUMN IF NOT EXISTS report_footer_text TEXT,
  ADD COLUMN IF NOT EXISTS report_contact_line TEXT,
  ADD COLUMN IF NOT EXISTS report_hide_platform_branding BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN organizations.report_logo_url IS
  'Optional logo URL shown on shareable HTML / PDF reports';
COMMENT ON COLUMN organizations.report_accent_color IS
  'Optional hex accent color for reports (e.g. #059669)';
COMMENT ON COLUMN organizations.report_footer_text IS
  'Optional custom footer line for reports';
COMMENT ON COLUMN organizations.report_contact_line IS
  'Optional contact line in report footer';
COMMENT ON COLUMN organizations.report_hide_platform_branding IS
  'When true, omit Maps Growth Agent platform credit from report footers';
