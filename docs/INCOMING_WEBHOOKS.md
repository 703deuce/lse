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

**Reviews → Integrations**

1. Pick a campaign  
2. Choose event type (e.g. `service.completed`)  
3. Start in **test** mode  
4. Copy the unique URL  
5. Send a sample event from Zapier/Make  
6. Confirm the event log  
7. Promote to **live**

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

Apply migration **`050_integration_webhooks.sql`**.

Optional env:

- `INTEGRATION_SECRET_KEY` — encrypts signing secrets at rest  
- `WEBHOOK_MAX_BODY_BYTES` — default 128KB  

## Related

- Legacy API-key automation (`/api/webhooks/automation`) remains for direct action calls.  
- Prefer **unique incoming endpoints** for CRM → campaign enrollment.
