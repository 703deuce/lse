# Automation webhooks (Zapier / Make / n8n)

First-class inbound API for review-request automations. One endpoint works with
Zapier, Make, n8n, Pipedream, and custom scripts — without building Jobber /
Housecall Pro / Stripe native integrations first.

## Endpoint

```
POST https://app.localexpress.com/api/webhooks/automation
```

`GET` returns supported actions (no auth required).

## Auth

Create a key under **Settings → Automations (Zapier / Make)**.

Send on every request:

```
Authorization: Bearer lse_<prefix>_<secret>
```

or

```
X-API-Key: lse_<prefix>_<secret>
```

Keys can be scoped to one business or the whole organization.

## Actions

| `action` | Purpose |
|----------|---------|
| `upsert_contact` | Create/update a CRM contact |
| `enroll_campaign` | Upsert contact + enroll into an existing campaign (SMS/email sequence) |
| `send_review_request` | Immediate one-off SMS or email review request |
| `suppress_contact` | Opt-out / suppress future messaging |

## Example: Jobber job completed → campaign

```json
{
  "action": "enroll_campaign",
  "businessId": "YOUR_BUSINESS_UUID",
  "campaignId": "YOUR_CAMPAIGN_UUID",
  "delayMinutes": 120,
  "firstName": "Jamie",
  "lastName": "Lee",
  "phone": "+15551234567",
  "email": "jamie@example.com",
  "jobType": "AC repair",
  "externalId": "jobber-job-123"
}
```

Zapier:

1. Trigger: Jobber → Job Closed / Completed  
2. Action: **Webhooks by Zapier → Custom Request**  
3. Method `POST`, URL = automation webhook  
4. Headers: `Authorization: Bearer …`, `Content-Type: application/json`  
5. Data: JSON above (map Jobber fields)

## Example: Stripe invoice paid → quick SMS

```json
{
  "action": "send_review_request",
  "businessId": "YOUR_BUSINESS_UUID",
  "channel": "sms",
  "name": "Alex Rivera",
  "phone": "+15559876543"
}
```

## Example: upsert only

```json
{
  "action": "upsert_contact",
  "businessId": "YOUR_BUSINESS_UUID",
  "name": "Casey Ng",
  "email": "casey@example.com",
  "tags": ["facebook-lead"]
}
```

Nested `contact: { … }` objects are also accepted.

## Recommended rollout

1. CSV import (already in product)  
2. **This webhook** ← you are here  
3. Official Zapier app (prettier picker UI)  
4. Make app  
5. Native integrations for the apps customers actually use via Zapier  

## Deploy notes

- Apply migration `049_organization_api_keys.sql`  
- Webhook path is public (`/api/webhooks/`); auth is API-key only  
- Campaign enroll requires an **active** or **scheduled** campaign and a Google review link  
