# Fix: unique index `idx_review_contacts_business_email_norm` fails

## Error

```
ERROR: 23505: could not create unique index "idx_review_contacts_business_email_norm"
DETAIL: Key (business_id, email_normalized)=(…, 703deuce@gmail.com) is duplicated.
```

## Cause

Legacy `review_request_contacts` rows share the same email for one business.
Migration `039` backfills `email_normalized` then tries to create a unique index.

## Fix (Supabase SQL editor)

1. Run **`supabase/migrations/041_dedupe_review_contacts_unique.sql`** first.  
   It merges/removes duplicate emails (and phones), then creates the unique indexes.
2. Re-run the rest of **`039_review_campaigns_foundation.sql`** and **`040_contacts_import_templates.sql`** if those didn’t finish earlier.

Or, if you only need the index to succeed right now, this quick clear also works (keeps one row’s email, nulls the rest):

```sql
WITH ranked AS (
  SELECT id,
    ROW_NUMBER() OVER (
      PARTITION BY business_id, lower(trim(customer_email))
      ORDER BY COALESCE(updated_at, created_at, now()) DESC, id
    ) AS rn
  FROM review_request_contacts
  WHERE customer_email IS NOT NULL AND trim(customer_email) <> ''
)
UPDATE review_request_contacts c
SET email_normalized = NULL
FROM ranked r
WHERE c.id = r.id AND r.rn > 1;

UPDATE review_request_contacts
SET email_normalized = lower(trim(customer_email))
WHERE customer_email IS NOT NULL
  AND (email_normalized IS NULL OR email_normalized = '');

CREATE UNIQUE INDEX IF NOT EXISTS idx_review_contacts_business_email_norm
  ON review_request_contacts(business_id, email_normalized)
  WHERE email_normalized IS NOT NULL;
```

Prefer **041** — it merges suppression flags and rewires `contact_id` FKs before delete.
