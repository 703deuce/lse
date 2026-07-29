-- Visual page themes for Pay & Review Page templates

ALTER TABLE payment_page_configurations
  ADD COLUMN IF NOT EXISTS page_theme TEXT NOT NULL DEFAULT 'modern_blue'
    CHECK (page_theme IN (
      'floral_pink',
      'modern_blue',
      'bold_professional',
      'minimal_elegant',
      'dark_luxury'
    ));
