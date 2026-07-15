-- Repair: unique contact indexes require one row per (business, email/phone).
-- Safe to re-run. Use this if 039 failed with:
--   ERROR 23505 could not create unique index "idx_review_contacts_business_email_norm"

-- Ensure columns exist (no-op if 039 already added them)
ALTER TABLE review_request_contacts
  ADD COLUMN IF NOT EXISTS first_name TEXT,
  ADD COLUMN IF NOT EXISTS last_name TEXT,
  ADD COLUMN IF NOT EXISTS phone_e164 TEXT,
  ADD COLUMN IF NOT EXISTS email_normalized TEXT,
  ADD COLUMN IF NOT EXISTS tags JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS source TEXT,
  ADD COLUMN IF NOT EXISTS external_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS customer_date DATE,
  ADD COLUMN IF NOT EXISTS last_service_date DATE,
  ADD COLUMN IF NOT EXISTS consent_state TEXT NOT NULL DEFAULT 'unknown',
  ADD COLUMN IF NOT EXISTS consent_source TEXT,
  ADD COLUMN IF NOT EXISTS consent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS sms_opt_out BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS email_unsubscribed BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_contacted_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS campaign_attempts INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS latest_reply_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS latest_reply_snippet TEXT,
  ADD COLUMN IF NOT EXISTS review_completion TEXT NOT NULL DEFAULT 'unknown';

-- Backfill normalized email from legacy field
UPDATE review_request_contacts
SET email_normalized = lower(trim(customer_email))
WHERE customer_email IS NOT NULL
  AND trim(customer_email) <> ''
  AND (email_normalized IS NULL OR email_normalized = '');

-- Blank strings are not unique keys — treat as null
UPDATE review_request_contacts
SET email_normalized = NULL
WHERE email_normalized IS NOT NULL AND trim(email_normalized) = '';

UPDATE review_request_contacts
SET phone_e164 = NULL
WHERE phone_e164 IS NOT NULL AND trim(phone_e164) = '';

-- Prefer digits-only legacy phones that already look like E.164 / 10–15 digit storage
UPDATE review_request_contacts
SET phone_e164 = CASE
  WHEN customer_phone ~ '^\+[1-9][0-9]{7,14}$' THEN customer_phone
  WHEN regexp_replace(customer_phone, '\D', '', 'g') ~ '^[0-9]{10}$'
    THEN '+1' || regexp_replace(customer_phone, '\D', '', 'g')
  WHEN regexp_replace(customer_phone, '\D', '', 'g') ~ '^[0-9]{11,15}$'
    THEN '+' || regexp_replace(customer_phone, '\D', '', 'g')
  ELSE phone_e164
END
WHERE phone_e164 IS NULL
  AND customer_phone IS NOT NULL
  AND trim(customer_phone) <> '';

-- ---------------------------------------------------------------------------
-- Deduplicate by email_normalized within a business
-- Keep the "best" row: prefer suppressed, then most recently updated
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    business_id,
    email_normalized,
    FIRST_VALUE(id) OVER (
      PARTITION BY business_id, email_normalized
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, email_normalized
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS rn
  FROM review_request_contacts
  WHERE email_normalized IS NOT NULL
),
dupes AS (
  SELECT id AS dupe_id, keeper_id
  FROM ranked
  WHERE rn > 1 AND id <> keeper_id
)
-- Merge suppression / reply fields onto keeper before delete
UPDATE review_request_contacts k
SET
  sms_opt_out = k.sms_opt_out OR COALESCE(d.sms_opt_out, false),
  email_unsubscribed = k.email_unsubscribed OR COALESCE(d.email_unsubscribed, false),
  campaign_attempts = GREATEST(COALESCE(k.campaign_attempts, 0), COALESCE(d.campaign_attempts, 0)),
  last_contacted_at = GREATEST(k.last_contacted_at, d.last_contacted_at),
  latest_reply_at = GREATEST(k.latest_reply_at, d.latest_reply_at),
  latest_reply_snippet = COALESCE(k.latest_reply_snippet, d.latest_reply_snippet),
  phone_e164 = COALESCE(k.phone_e164, d.phone_e164),
  customer_phone = COALESCE(k.customer_phone, d.customer_phone),
  first_name = COALESCE(k.first_name, d.first_name),
  last_name = COALESCE(k.last_name, d.last_name),
  customer_name = COALESCE(k.customer_name, d.customer_name),
  updated_at = now()
FROM dupes map
JOIN review_request_contacts d ON d.id = map.dupe_id
WHERE k.id = map.keeper_id;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY business_id, email_normalized
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, email_normalized
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS rn
  FROM review_request_contacts
  WHERE email_normalized IS NOT NULL
),
dupes AS (
  SELECT id AS dupe_id, keeper_id
  FROM ranked
  WHERE rn > 1 AND id <> keeper_id
)
UPDATE review_request_sends s
SET contact_id = map.keeper_id
FROM dupes map
WHERE s.contact_id = map.dupe_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_request_recipients' AND column_name = 'contact_id'
  ) THEN
    WITH ranked AS (
      SELECT
        id,
        FIRST_VALUE(id) OVER (
          PARTITION BY business_id, email_normalized
          ORDER BY
            (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
            COALESCE(updated_at, created_at, now()) DESC,
            id
        ) AS keeper_id,
        ROW_NUMBER() OVER (
          PARTITION BY business_id, email_normalized
          ORDER BY
            (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
            COALESCE(updated_at, created_at, now()) DESC,
            id
        ) AS rn
      FROM review_request_contacts
      WHERE email_normalized IS NOT NULL
    ),
    dupes AS (
      SELECT id AS dupe_id, keeper_id
      FROM ranked
      WHERE rn > 1 AND id <> keeper_id
    )
    UPDATE review_request_recipients r
    SET contact_id = map.keeper_id
    FROM dupes map
    WHERE r.contact_id = map.dupe_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'review_campaign_attributions'
  ) THEN
    WITH ranked AS (
      SELECT
        id,
        FIRST_VALUE(id) OVER (
          PARTITION BY business_id, email_normalized
          ORDER BY
            (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
            COALESCE(updated_at, created_at, now()) DESC,
            id
        ) AS keeper_id,
        ROW_NUMBER() OVER (
          PARTITION BY business_id, email_normalized
          ORDER BY
            (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
            COALESCE(updated_at, created_at, now()) DESC,
            id
        ) AS rn
      FROM review_request_contacts
      WHERE email_normalized IS NOT NULL
    ),
    dupes AS (
      SELECT id AS dupe_id, keeper_id
      FROM ranked
      WHERE rn > 1 AND id <> keeper_id
    )
    UPDATE review_campaign_attributions a
    SET contact_id = map.keeper_id
    FROM dupes map
    WHERE a.contact_id = map.dupe_id;
  END IF;
END $$;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY business_id, email_normalized
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, email_normalized
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS rn
  FROM review_request_contacts
  WHERE email_normalized IS NOT NULL
),
dupes AS (
  SELECT id AS dupe_id
  FROM ranked
  WHERE rn > 1
)
DELETE FROM review_request_contacts c
USING dupes d
WHERE c.id = d.dupe_id;

-- ---------------------------------------------------------------------------
-- Deduplicate by phone_e164 within a business (same keep rules)
-- ---------------------------------------------------------------------------
WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY business_id, phone_e164
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, phone_e164
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS rn
  FROM review_request_contacts
  WHERE phone_e164 IS NOT NULL
),
dupes AS (
  SELECT id AS dupe_id, keeper_id
  FROM ranked
  WHERE rn > 1 AND id <> keeper_id
)
UPDATE review_request_contacts k
SET
  sms_opt_out = k.sms_opt_out OR COALESCE(d.sms_opt_out, false),
  email_unsubscribed = k.email_unsubscribed OR COALESCE(d.email_unsubscribed, false),
  campaign_attempts = GREATEST(COALESCE(k.campaign_attempts, 0), COALESCE(d.campaign_attempts, 0)),
  last_contacted_at = GREATEST(k.last_contacted_at, d.last_contacted_at),
  latest_reply_at = GREATEST(k.latest_reply_at, d.latest_reply_at),
  latest_reply_snippet = COALESCE(k.latest_reply_snippet, d.latest_reply_snippet),
  email_normalized = COALESCE(k.email_normalized, d.email_normalized),
  customer_email = COALESCE(k.customer_email, d.customer_email),
  first_name = COALESCE(k.first_name, d.first_name),
  last_name = COALESCE(k.last_name, d.last_name),
  customer_name = COALESCE(k.customer_name, d.customer_name),
  updated_at = now()
FROM dupes map
JOIN review_request_contacts d ON d.id = map.dupe_id
WHERE k.id = map.keeper_id;

WITH ranked AS (
  SELECT
    id,
    FIRST_VALUE(id) OVER (
      PARTITION BY business_id, phone_e164
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS keeper_id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, phone_e164
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS rn
  FROM review_request_contacts
  WHERE phone_e164 IS NOT NULL
),
dupes AS (
  SELECT id AS dupe_id, keeper_id
  FROM ranked
  WHERE rn > 1 AND id <> keeper_id
)
UPDATE review_request_sends s
SET contact_id = map.keeper_id
FROM dupes map
WHERE s.contact_id = map.dupe_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'review_request_recipients' AND column_name = 'contact_id'
  ) THEN
    WITH ranked AS (
      SELECT
        id,
        FIRST_VALUE(id) OVER (
          PARTITION BY business_id, phone_e164
          ORDER BY
            (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
            COALESCE(updated_at, created_at, now()) DESC,
            id
        ) AS keeper_id,
        ROW_NUMBER() OVER (
          PARTITION BY business_id, phone_e164
          ORDER BY
            (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
            COALESCE(updated_at, created_at, now()) DESC,
            id
        ) AS rn
      FROM review_request_contacts
      WHERE phone_e164 IS NOT NULL
    ),
    dupes AS (
      SELECT id AS dupe_id, keeper_id
      FROM ranked
      WHERE rn > 1 AND id <> keeper_id
    )
    UPDATE review_request_recipients r
    SET contact_id = map.keeper_id
    FROM dupes map
    WHERE r.contact_id = map.dupe_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_name = 'review_campaign_attributions'
  ) THEN
    WITH ranked AS (
      SELECT
        id,
        FIRST_VALUE(id) OVER (
          PARTITION BY business_id, phone_e164
          ORDER BY
            (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
            COALESCE(updated_at, created_at, now()) DESC,
            id
        ) AS keeper_id,
        ROW_NUMBER() OVER (
          PARTITION BY business_id, phone_e164
          ORDER BY
            (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
            COALESCE(updated_at, created_at, now()) DESC,
            id
        ) AS rn
      FROM review_request_contacts
      WHERE phone_e164 IS NOT NULL
    ),
    dupes AS (
      SELECT id AS dupe_id, keeper_id
      FROM ranked
      WHERE rn > 1 AND id <> keeper_id
    )
    UPDATE review_campaign_attributions a
    SET contact_id = map.keeper_id
    FROM dupes map
    WHERE a.contact_id = map.dupe_id;
  END IF;
END $$;

WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, phone_e164
      ORDER BY
        (COALESCE(email_unsubscribed, false) OR COALESCE(sms_opt_out, false)) DESC,
        COALESCE(updated_at, created_at, now()) DESC,
        id
    ) AS rn
  FROM review_request_contacts
  WHERE phone_e164 IS NOT NULL
),
dupes AS (
  SELECT id AS dupe_id
  FROM ranked
  WHERE rn > 1
)
DELETE FROM review_request_contacts c
USING dupes d
WHERE c.id = d.dupe_id;

-- If two keepers still collide on email after phone merge (rare), null the losing email
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, email_normalized
      ORDER BY COALESCE(updated_at, created_at, now()) DESC, id
    ) AS rn
  FROM review_request_contacts
  WHERE email_normalized IS NOT NULL
)
UPDATE review_request_contacts c
SET email_normalized = NULL, updated_at = now()
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_contacts_business_phone_e164
  ON review_request_contacts(business_id, phone_e164)
  WHERE phone_e164 IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_contacts_business_email_norm
  ON review_request_contacts(business_id, email_normalized)
  WHERE email_normalized IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_review_contacts_business_updated
  ON review_request_contacts(business_id, updated_at DESC);
