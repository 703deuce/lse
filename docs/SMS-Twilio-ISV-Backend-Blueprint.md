# Local SEO Express — SMS / Twilio ISV Backend Blueprint

**Purpose:** If you were building (or wiring) another backend from scratch, this is the complete start-to-finish guide for our SMS system: Twilio ISV, buying numbers, A2P 10DLC per client, one-off sends, bulk sends, and multi-step campaigns/automations.

**Product:** Local SEO Express (`lse`)  
**Live app:** `https://app.localseoexpress.com`  
**Status:** This documents what is **already implemented** in the codebase — not a wishlist.

---

## 0. Mental model (read this first)

We are a **Twilio ISV**. We do **not** send all customer SMS from one shared From-number forever.

```
Parent ISV Twilio account
  └── Per customer business → Twilio Subaccount
        ├── Secondary Customer Profile (TrustHub)
        ├── A2P Trust Product
        ├── Brand Registration (BN…)
        ├── Messaging Service (MG…)
        ├── US A2P Campaign / 10DLC (QE… / usAppToPerson)
        └── Purchased phone number attached to Messaging Service
```

**Outbound SMS only works when that chain is `ready`.**  
Until then: numbers can be purchased, forms can be filled, registration can be in review — but campaign/quick SMS is blocked on the live ISV path.

**Two clocks for campaigns:**
1. Recipient wait clock → `review_request_recipients.next_action_at`
2. Message send clock → `review_request_messages.scheduled_for`

**Minute cron + workers fire everything.** Browsers do not run drip timers.

---

## 1. What you must provision (ops)

### 1.1 Twilio ISV account
1. Twilio account approved as **ISV / ISV-like** with a **Primary Customer Profile** (`BU…`).
2. TrustHub policies for Secondary Customer Profile + A2P Trust Product available.
3. Ability to create **subaccounts**, Brand Registrations, Messaging Services, and US A2P Campaigns.

### 1.2 Environment variables (minimum live set)

| Variable | Purpose |
|---|---|
| `TWILIO_ACCOUNT_SID` | Parent account SID (`AC…`) |
| `TWILIO_ACCOUNT_AUTH_TOKEN` | Parent Auth Token (TrustHub + webhook signatures). Aliases: `TWILIO_PARENT_AUTH_TOKEN`, `TWILIO_WEBHOOK_AUTH_TOKEN` |
| `TWILIO_API_KEY_SID` + `TWILIO_AUTH_TOKEN` | API key pair (legacy parent send path) |
| `TWILIO_PRIMARY_PROFILE_SID` | Approved ISV Primary Profile (`BU…`) |
| `TWILIO_MODE=live` **or** `MESSAGING_ADAPTER=twilio` | Turn on live adapter (otherwise mock) |
| `TWILIO_STATUS_EMAIL` / `MESSAGING_STATUS_EMAIL` | TrustHub status inbox |
| `APP_URL` / `NEXT_PUBLIC_APP_URL` / `TWILIO_STATUS_CALLBACK_BASE_URL` | Public HTTPS base for webhooks |
| `INTEGRATION_SECRET_KEY` | Encrypt subaccount auth tokens at rest |
| `MESSAGING_NUMBER_GRACE_DAYS` | Auto-release unused purchased numbers (default 14) |
| `CRON_SECRET` | Auth for `/api/jobs/process` |
| `QUEUE_DRIVER=bullmq` | Use Redis workers |
| `REDIS_URL` | Upstash / Redis |
| `BREVO_API_KEY` | Email delivery for campaigns/quick send |
| `REVIEW_REQUEST_FROM_EMAIL` / `REVIEW_REQUEST_FROM_NAME` | From identity for review emails |
| Supabase service keys | DB |

Optional / legacy:
- `TWILIO_FROM_NUMBER` — parent From for non-ISV/mock path
- `TWILIO_TRIAL_SMS_TEMPLATE` — body override on legacy parent send
- `TWILIO_GLOBAL_START_RATE_PER_SEC`, `TWILIO_GLOBAL_MAX_IN_FLIGHT` — Redis provider throttle

### 1.3 Always-on processes
1. **Web app** (Next.js) — APIs + UI
2. **Worker:** `npm run worker:all` (campaigns + A2P advance + SMS/email sends)
3. **Cron every minute:**
   ```bash
   curl -X POST "https://app.localseoexpress.com/api/jobs/process" \
     -H "Authorization: Bearer $CRON_SECRET"
   ```
4. Do **not** also run a separate `worker:messaging` if `worker:all` is already running.

### 1.4 Public webhooks Twilio must hit
| URL | Purpose |
|---|---|
| `{APP_URL}/api/twilio/inbound` | Inbound SMS (STOP/replies) |
| `{APP_URL}/api/twilio/message-status` | Delivery receipts |
| `{APP_URL}/api/twilio/compliance-status` | TrustHub / Brand status callbacks → enqueue registration advance |

These are attached to each customer Messaging Service / numbers as registration progresses.

---

## 2. Data model (tables you need)

### Messaging (per business)
- `messaging_registrations` — **one row per business** (`UNIQUE(business_id)`)
  - Subaccount SIDs/tokens (encrypted)
  - Profile / Trust / Brand / Messaging Service / Campaign SIDs
  - Phone E.164 + Twilio PN SID + attached flags
  - Step statuses + `overall_status` + `messaging_enabled` / paused
- `messaging_registration_events` — audit log of registration progress

### Review requests / campaigns
- `review_request_links` — Google review URL + tracking base
- `review_request_templates` — SMS/email templates
- `review_request_contacts` — customers
- `review_request_sends` — one-off sends
- `review_request_events` — analytics events
- `review_request_campaigns` — campaign header (`sequence_json`, channel, success_mode, daily limits, triggers…)
- `review_request_uploads` — CSV upload batches
- `review_request_recipients` — enrolled contacts (`workflow_status`, `current_step`, `next_action_at`)
- `review_request_messages` — each SMS/email attempt (`queued|sending|sent|delivered|failed|clicked|skipped|…`, `scheduled_for`, `tracking_token`)
- `review_request_clicks` — link clicks
- `review_request_suppression` — STOP / unsub / do-not-contact
- `review_request_replies` — inbound replies
- `review_campaign_steps` — normalized sequence steps
- `review_campaign_runs` — run metadata

### Automations
- `integration_webhook_endpoints` — Zapier/Make/n8n inbound URLs
- `integration_webhook_events` / `integration_webhook_contact_matches`

### Jobs
- `job_queue` (paired with BullMQ when `QUEUE_DRIVER=bullmq`)

---

## 3. Status machines you must implement

### 3.1 Messaging registration (customer-facing)
`overall_status` / step statuses use:
`not_started | action_required | submitted | in_review | approved | failed | suspended | ready`

**Setup steps (UI wizard):**
`overview → business → use_case → review → status → number → ready`

**Ready means (live):**
- Secondary profile + trust product approved (as required by Twilio)
- Brand `APPROVED`
- A2P Campaign `VERIFIED`
- Messaging Service exists
- Phone purchased **and attached** to Messaging Service
- `messaging_enabled = true`
- not paused

### 3.2 Campaign
`draft | scheduled | active | paused | completed | cancelled | failed | archived`

### 3.3 Recipient workflow
`pending | scheduled | in_progress | waiting | completed | stopped | failed | opted_out`

### 3.4 Message
`queued | sending | sent | delivered | failed | clicked | opted_out | skipped | cancelled…`

---

## 4. End-to-end: onboard one client for SMS (A2P)

This is the exact product path.

### Step A — Create / open registration
**API:** `POST /api/messaging/registration`  
**Action:** `start`  
**Body:** `{ businessId, action: "start" }`

**Backend must:**
1. Create Twilio **subaccount** for this business (`accounts.create`).
2. Encrypt + store subaccount auth token.
3. Create Secondary Customer Profile shell under ISV Primary Profile (or prepare for it).
4. Persist SIDs on `messaging_registrations`.
5. Return current registration + progress steps.

**Code map:**
- `src/lib/messaging/service.ts` → `messagingOnboarding`
- `src/lib/messaging/twilio-adapter.ts` → `createCustomerSubaccount`
- `src/lib/messaging/registration-processor.ts` → `advanceMessagingRegistration`

### Step B — Save business details
**Action:** `save_business`  
Collect legal business name, EIN/tax id (as required), address, contact, industry, company type, website, etc.  
Validate with app rules, map to Twilio TrustHub attribute enums (`twilio-mappings.ts`), store on registration row.

### Step C — Save SMS use case
**Action:** `save_use_case`  
Collect use-case description, sample messages, opt-in description, help/stop language, vertical, estimated volume, etc.  
This feeds Brand + Campaign creation later.

### Step D — (Optional anytime) Buy a number
**Search:** `GET /api/messaging/numbers?businessId=…&areaCode=…`  
**Purchase:** `POST /api/messaging/registration` action `purchase_number` `{ phoneNumber }`

**Backend must:**
1. Ensure subaccount exists (buy-anytime path may create it).
2. Purchase PN on **subaccount** (`incomingPhoneNumbers.create`).
3. Store E.164 + PN SID + `phone_number_purchased_at`.
4. **Do not** enable outbound yet.
5. Enqueue `messaging_registration_advance` so PN can attach to Messaging Service once Brand/MS exist.
6. Support `release_number` and grace-period auto-release if A2P never starts.

**UI:** `/businesses/{businessId}/reputation/messaging/number`

### Step E — Customer certifies + submit
**Action:** `submit`  
Requires certification checkboxes.

**Backend must:**
1. Create/submit Secondary Customer Profile (TrustHub end users, address, docs, evaluation, entity assignments, `pending-review`).
2. Enqueue registration advance job.

### Step F — Worker advances A2P automatically
**Job type:** `messaging_registration_advance`  
**Queue:** `review-campaign`  
**Enqueue helper:** `enqueueMessagingRegistrationAdvance(businessId)`  
**Idempotency:** `messaging-registration-advance:{businessId}`  
**Handler:** `advanceMessagingRegistration`

**Worker sequence:**
1. Create/submit **A2P Trust Product** (may proceed before profile fully approved).
2. Create **Brand Registration** (low-volume may skip automatic secondary vetting).
3. If Brand not `APPROVED` → `JobDeferredError` (~15 min) and retry later.
4. Create **Messaging Service** with inbound + status callback URLs.
5. If phone already purchased → **attach** PN to Messaging Service.
6. Create **US A2P Campaign** (`usAppToPerson.create`) with sample messages / use case.
7. If campaign not `VERIFIED` → defer ~15 min and poll.
8. When verified + PN attached → set `messaging_enabled`, `overall_status=ready`.

Also advanced by:
- Compliance status webhook
- Manual `refresh_status` action
- Post-purchase enqueue

**UI status page:** `/businesses/{businessId}/reputation/messaging/status`

### Step G — Activate / pause / test
Actions: `activate`, `pause`, `resume`, `send_test`  
Test SMS must go through Messaging Service SID once ready.

---

## 5. Sending SMS / email once ready

### 5.1 Prerequisites for live SMS
- Registration `ready` / `isMessagingReady(registration)`
- Active review link for the business (`review_request_links`)
- Entitlement / permission for campaign send
- Not on suppression list
- Org outbound not paused / billing healthy (as enforced by app)

### 5.2 Individual (one-off) send

**SMS API:** `POST /api/reputation/review-requests/send-sms`
```json
{
  "businessId": "…",
  "customerName": "Jane Doe",
  "customerPhone": "+15551234567",
  "serviceType": "Junk Removal",
  "templateId": "optional-uuid",
  "customMessage": "optional override"
}
```

**Email API:** `POST /api/reputation/review-requests/send-email`
```json
{
  "businessId": "…",
  "customerName": "Jane Doe",
  "customerEmail": "jane@example.com",
  "serviceType": "Junk Removal",
  "templateId": "optional-uuid",
  "customMessage": "optional override"
}
```

**Backend must:**
1. Auth + `requireCampaignSendAccess` / `campaign.send`
2. Load review link; fail if missing
3. Render template merge fields (`customer_name`, `business_name`, `review_link`, `service_type`)
4. Create tracking token → tracked URL `/r/{token}` (redirects to Google review URL)
5. Insert `review_request_sends` + events; upsert contact (`source: quick_send`)
6. **SMS deliver:** `sendSmsViaMessagingService({ messagingServiceSid, to, body })` on customer subaccount  
   (Legacy fallback only when live ISV off: parent `TWILIO_FROM_NUMBER`)
7. **Email deliver:** Brevo
8. Reserve usage counters (`review_sms_sent` / `review_emails_sent`)

**UI:** `/businesses/{id}/reputation/requests` (One-Time Send)

**Important:** Quick Send is **synchronous** (API does the send). Campaign drips are **queued**.

### 5.3 Bulk send
Bulk is not “fire 500 Twilio calls in one HTTP request.”

1. Create campaign with recipients (CSV / contacts / paste)
2. Validate with `validateBulkRecipients` (suppression, duplicates, recent contact windows)
3. Insert campaign + recipients + initial queued messages / workflow state
4. Set campaign `active` or `scheduled`
5. Let cron/worker drain due messages

**API:** `POST /api/reputation/review-requests/campaigns`  
**Contacts import (CRM):** `POST /api/reputation/contacts/import`

---

## 6. Campaigns = automations / flows

### 6.1 Sequence JSON (the flow definition)
Stored on `review_request_campaigns.sequence_json` (and mirrored in `review_campaign_steps`).

**Step types:**
| Type | Meaning |
|---|---|
| `send_sms` | Queue/send SMS for this step |
| `send_email` | Queue/send email for this step |
| `wait` | Pause (`days` / `hours` / `minutes`) via `next_action_at` |
| `condition` | Branch / gate (e.g. only continue if no click) |
| `end` | Stop sequence |

**Example (SMS → wait 2 days → email → wait 2 days → SMS → stop):**
```json
[
  { "step_key": "sms_1", "step_type": "send_sms", "config": { "template_role": "initial" } },
  { "step_key": "wait_2d", "step_type": "wait", "config": { "days": 2 } },
  { "step_key": "email_1", "step_type": "send_email", "config": { "template_role": "reminder" } },
  { "step_key": "wait_2d_b", "step_type": "wait", "config": { "days": 2 } },
  {
    "step_key": "gate_no_click",
    "step_type": "condition",
    "config": { "when": "no_activity", "then": "sms_2", "else": "end" }
  },
  { "step_key": "sms_2", "step_type": "send_sms", "config": { "template_role": "final_reminder" } },
  { "step_key": "end", "step_type": "end", "config": {} }
]
```

**Wait math:** `waitDurationMs(config)` from `days|hours|minutes` (minimum 1 minute).  
**Default success mode:** `click` — if they click the tracked review link, stop remaining steps.

**Condition facts include:**
`message_delivered | link_clicked | customer_replied | customer_opted_out | review_detected | no_activity | valid_phone | valid_email`

### 6.2 How “wait 3 hours” actually works
1. Contact enrolled.
2. If first step is wait `{ hours: 3 }` → set:
   - `workflow_status = 'waiting'`
   - `next_action_at = now + 3 hours` (+ optional webhook delay minutes)
3. Every minute cron → `campaign_send_batch` → `processSequenceWaits()`
4. Select recipients where `waiting` AND `next_action_at <= now`
5. CAS claim `waiting → in_progress`
6. Advance interpreter to next send/wait/end
7. For send steps: insert/update `review_request_messages` with `scheduled_for`, enqueue `send_campaign_sms` / `send_campaign_email`

### 6.3 Enrollment sources (all share one engine)
Shared function: `enrollContactInCampaign` (`src/lib/automations/enroll-campaign.ts`)

| Source | How |
|---|---|
| Manual | Campaign UI / enroll API |
| CSV / contacts | Campaign create / import |
| Webhook (Zapier/Make/n8n) | `POST /api/integrations/webhooks/incoming/{token}` |
| API key automation | `POST /api/webhooks/automation` action `enroll_campaign` |

Webhook endpoints can add `send_delay_minutes` (e.g. 120) before first action — “job completed → wait 2 hours → start sequence.”

### 6.4 Drain / worker pipeline (must exist)
```
Cron * * * * *
  → POST /api/jobs/process
  → enqueue campaign_send_batch (idempotent per minute)
  → enqueueDueCampaignMessages()
       ├─ processSequenceWaits()          // due waits
       └─ find due queued messages        // scheduled_for <= now, windows, daily caps
            → enqueue send_campaign_sms / send_campaign_email
  → worker:all
       → sendCampaignMessageById()
            → Twilio Messaging Service (SMS) / Brevo (email)
            → tryAdvanceRecipientAfterSend()
```

**Job map:**
| Job | Queue | Does |
|---|---|---|
| `messaging_registration_advance` | `review-campaign` | A2P state machine |
| `campaign_send_batch` | `review-campaign` | Drain due waits + queue sends |
| `send_campaign_sms` | `sms-send` | Deliver one SMS |
| `send_campaign_email` | `email-send` | Deliver one email |
| `integration_webhook_process` | `review-import` | Map payload → enroll |
| `import_contacts` | `review-import` | CSV contact import |

### 6.5 Click tracking + follow-up suppression
1. Every campaign/quick message gets `tracking_token`
2. Body uses tracked URL `/r/{token}`
3. `GET /r/{token}` → `recordTrackingClick`:
   - insert `review_request_clicks`
   - mark message `clicked`
   - redirect to Google review URL
4. If campaign `success_mode = click` (default):
   - complete recipient
   - skip remaining queued messages (`stopped: link_clicked`)
5. Also stop on STOP/opt-out, reply (per rules), or detected review attribution

### 6.6 Multi-tenant scale notes
- Per-minute batch caps (~50–100 waits/sends per tick) — backlog drains across following minutes
- Provider rate limiters (Twilio/Brevo)
- Per-campaign `daily_send_limit`
- Message claim CAS prevents double-send
- Wait claim CAS prevents double-advance
- Soft spot: drain is global (not perfectly fair round-robin by org). Fine for modest multi-tenant volume; tune for heavy load.

---

## 7. Code map (where to look / what to copy)

### Messaging / Twilio ISV
| File | Responsibility |
|---|---|
| `src/lib/messaging/twilio-config.ts` | Live gate, credentials, webhook URLs, policy SIDs |
| `src/lib/messaging/twilio-client.ts` | Parent + subaccount Twilio clients |
| `src/lib/messaging/twilio-adapter.ts` | Subaccount + Secondary Profile |
| `src/lib/messaging/twilio-onboarding.ts` | Trust → Brand → MS → Campaign → number → send |
| `src/lib/messaging/twilio-mappings.ts` | TrustHub enum maps |
| `src/lib/messaging/mock-adapter.ts` | Local/dev mock approvals |
| `src/lib/messaging/service.ts` | Facade used by APIs |
| `src/lib/messaging/registration-processor.ts` | Worker A2P advance |
| `src/lib/messaging/store.ts` | Persistence |
| `src/lib/messaging/enqueue-advance.ts` | Enqueue advance job |
| `src/lib/messaging/status.ts` | Ready checks / progress steps |
| `src/app/api/messaging/registration/route.ts` | Registration API |
| `src/app/api/messaging/numbers/route.ts` | Number search API |

### Sends + campaigns
| File | Responsibility |
|---|---|
| `src/lib/reputation/review-sends.ts` | One-off SMS/email |
| `src/lib/reputation/campaigns.ts` | Create campaign, clicks, complete-on-success |
| `src/lib/reputation/sequence-engine.ts` | Pure sequence interpreter + wait math |
| `src/lib/reputation/sequence-runner.ts` | Persist waits, advance, after-send |
| `src/lib/reputation/campaign-processor.ts` | Due drain |
| `src/lib/reputation/campaign-message-send.ts` | Worker deliver one message |
| `src/lib/automations/enroll-campaign.ts` | Shared enrollment |
| `src/lib/integrations/webhook-process.ts` | Zapier/Make → enroll |
| `src/lib/jobs/queue.ts` | Recurring drains |
| `src/lib/queue/job-handlers.ts` | Job handlers |
| `src/app/api/jobs/process/route.ts` | Cron entrypoint |
| `src/app/r/[trackingToken]/route.ts` | Click redirect |

### Docs already in repo
- `docs/COOLIFY_CRON_CAMPAIGNS.md`
- `docs/QUEUE_ARCHITECTURE.md`
- `docs/PRODUCTION_WEBHOOKS.md`
- `docs/REVIEW_CAMPAIGNS_AUDIT.md`

---

## 8. Backend checklist: build this from scratch

Use this as an implementation acceptance list.

### A. Platform
- [ ] Twilio ISV parent + Primary Profile SID configured
- [ ] Live adapter enabled (`TWILIO_MODE=live` or `MESSAGING_ADAPTER=twilio`)
- [ ] Redis + BullMQ worker (`worker:all`) running
- [ ] Minute cron → `/api/jobs/process`
- [ ] Public HTTPS webhooks reachable by Twilio
- [ ] Brevo configured for email channel
- [ ] Subaccount tokens encrypted at rest

### B. Per-client messaging
- [ ] `start` creates subaccount + registration row
- [ ] Business + use-case save with validation
- [ ] Number search + purchase on subaccount anytime
- [ ] Submit creates/submits TrustHub Secondary Profile
- [ ] Worker creates Trust Product → Brand → Messaging Service → Campaign
- [ ] Poll/defer until Brand APPROVED + Campaign VERIFIED
- [ ] Attach purchased number to Messaging Service
- [ ] Flip `messaging_enabled` + `ready` only then
- [ ] Pause / resume / test send works
- [ ] Compliance webhook re-enqueues advance

### C. One-off send
- [ ] Review link required
- [ ] Template merge + tracked `/r/{token}` link
- [ ] SMS via Messaging Service SID (not shared From) when live
- [ ] Email via Brevo
- [ ] Suppression + entitlement checks
- [ ] Persist send + events + contact upsert

### D. Bulk + campaigns
- [ ] Create campaign with sequence JSON
- [ ] Validate recipients (dupes, suppression, windows)
- [ ] Enroll from CSV / contacts / webhook / API
- [ ] Wait steps set `next_action_at`
- [ ] Minute drain advances due waits
- [ ] Due messages claimed + sent by workers
- [ ] Click completes recipient when `success_mode=click`
- [ ] STOP/opt-out stops future messages
- [ ] Daily send limits + send windows respected
- [ ] Multi-step SMS↔email sequences work across days

### E. Automations
- [ ] Webhook endpoint create/rotate/revoke
- [ ] Incoming webhook maps fields → enroll
- [ ] Optional `send_delay_minutes` before first step
- [ ] Idempotent event processing

---

## 9. Example “day in the life” for one client

1. Business signs up → org/business created in app.
2. Owner opens **Messaging** → completes business + use case → submits.
3. Optionally buys local number while waiting.
4. Worker + Twilio review Brand/Campaign (hours–days depending on Twilio).
5. Status becomes **ready**; number attached; messaging enabled.
6. Owner generates Google **review link**.
7. Owner sends one test review request SMS from Requests page.
8. Owner creates a **Campaign**: SMS now → wait 2 days → email if no click → wait 2 days → final SMS → end.
9. Owner uploads 200 contacts (or connects Zapier “job completed” webhook).
10. Cron every minute advances waits and queues due messages.
11. Workers send via that client’s Messaging Service / Brevo.
12. Customer clicks tracked link → recipient completed → no more follow-ups.
13. Customer texts STOP → suppression row → no more SMS.

That is the full loop the backend must support.

---

## 10. Non-goals / out of scope here
- Stripe billing / self-serve checkout (separate)
- Google Business Profile OAuth / auto-post replies (separate; coming soon)
- Replacing Twilio with another SMS provider (would require new adapter behind `messagingOnboarding`)

---

## 11. Quick API cheat sheet

| Capability | Method + path |
|---|---|
| Registration CRUD/actions | `GET/POST /api/messaging/registration` |
| Search numbers | `GET /api/messaging/numbers` |
| One-off SMS | `POST /api/reputation/review-requests/send-sms` |
| One-off email | `POST /api/reputation/review-requests/send-email` |
| Create campaign | `POST /api/reputation/review-requests/campaigns` |
| Enroll into campaign | `POST /api/reputation/review-requests/campaigns/{id}/enroll` |
| Incoming automation webhook | `POST /api/integrations/webhooks/incoming/{token}` |
| API automation | `POST /api/webhooks/automation` |
| Cron drain | `POST /api/jobs/process` |
| Click tracking | `GET /r/{trackingToken}` |
| Twilio inbound/status | `/api/twilio/inbound`, `/api/twilio/message-status` |
| Twilio compliance | `/api/twilio/compliance-status` |

---

*Generated for Local SEO Express backend onboarding. If implementing in another service, keep the same state machines, job types, and “ready before send” gate — that is what makes A2P + drips correct and multi-tenant safe.*
