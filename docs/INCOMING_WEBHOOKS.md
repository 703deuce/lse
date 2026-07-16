# Automatic Review Triggers — Incoming Webhooks

Production incoming webhooks for Zapier, Make, n8n, Pipedream, CRMs, and custom apps.

## Endpoint

```
POST /api/integrations/webhooks/incoming/{endpointToken}
```

- Organization / business / campaign are resolved **server-side** from the endpoint config.
- Payload `organizationId` / `businessId` fields are ignored.
- Handler returns **202 Accepted** after writing the event ledger and enqueueing work.
- SMS/email are **never** sent inside the HTTP request — existing campaign workers send.

## Auth modes

| Mode | How |
|------|-----|
| Simple (default) | Long unguessable URL token (`lsewh_…`, 256-bit entropy, stored hashed) |
| Signed | Also require `X-LSE-Timestamp` + `X-LSE-Signature` (HMAC-SHA256 over `timestamp.rawBody`) |

## Create in the app

**Reviews → Review Triggers** (Automatic Review Triggers)

5-step wizard:

1. Name + Review Campaign  
2. Trigger event, delay, duplicate window, test mode  
3. Paste sample JSON → auto-detect field mapping + contact rules  
4. Security: simple URL token or signed HMAC  
5. Review → create → copy URL (shown once)

Then send a sample from Zapier/Make, confirm the event log, and promote to **live**.

### Plan quotas

| Plan | Endpoints | Events / month |
|------|-----------|----------------|
| Starter | 0 (no campaigns) | 0 |
| Pro | 5 | 5,000 |
| Agency | 25 | 50,000 |

### Ambiguous contact matches

If `external_customer_id` points at one contact and phone/email at another, the event is held as `needs_review`. Resolve under **Contact match review** on the Review Triggers page (link to a contact or skip).

## Canonical payload

```json
{
  "event_id": "job_87423_completed",
  "event_type": "service.completed",
  "occurred_at": "2026-07-16T14:30:00Z",
  "customer": {
    "external_id": "customer_4812",
    "first_name": "Anthony",
    "last_name": "Johnson",
    "email": "customer@example.com",
    "phone": "+15405551212"
  },
  "transaction": {
    "external_id": "job_87423",
    "type": "junk_removal",
    "completed_at": "2026-07-16T14:30:00Z"
  },
  "consent": { "email": true, "sms": true }
}
```

Minimum: event id (or auto-derived), event type, email or phone.

## Processing

1. Authenticate endpoint token (+ optional HMAC)  
2. Rate-limit / size-limit  
3. Insert `integration_webhook_events` (idempotent on `endpoint_id + external_event_id`)  
4. Enqueue `integration_webhook_process` on `review-import` queue  
5. Worker upserts contact + `enrollContactInCampaign` (existing pipeline)  
6. Campaign workers send messages on schedule  

## Test mode

- Accepts and logs events  
- May upsert contacts  
- Does **not** enroll for real sends / does not consume SMS-email campaign sends  
- Promote to live from the UI (server-side flag — not client-controlled)

## Deploy

Apply migrations:

- **`050_integration_webhooks.sql`**
- **`051_webhook_followups.sql`** (contact match review + `needs_review` status)

Optional env:

- `INTEGRATION_SECRET_KEY` — encrypts signing secrets at rest  
- `WEBHOOK_MAX_BODY_BYTES` — default 128KB  
- `RETENTION_WEBHOOK_PAYLOAD_DAYS` — scrub payload JSON (default 30); hashes/status kept  

## Related

- Legacy API-key automation (`/api/webhooks/automation`) remains for direct action calls.  
- Prefer **unique incoming endpoints** for CRM → campaign enrollment.
