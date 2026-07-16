# Coolify / Hetzner — Review Campaigns cron

Campaign SMS/email sends do **not** run inside long HTTP browser requests.

With `QUEUE_DRIVER=bullmq` (recommended once Redis + messaging worker are live):

```
Cron → POST /api/jobs/process
     → enqueue campaign_send_batch (orchestrator)
     → messaging worker finds due messages
     → enqueue send_campaign_email / send_campaign_sms
     → messaging worker → Brevo / Twilio
```

The cron stays lightweight. Twilio/Brevo run only on `npm run worker:messaging`.

`GET|POST /api/jobs/process` still:
1. Reclaims stale scan / job-queue work
2. Enqueues the per-minute campaign drain (idempotent)

On Coolify (Hetzner), schedule an **external cron** (or Coolify Scheduled Task) that hits your public app URL. Do not rely on `node-cron` inside the Next.js process — deploys and restarts would miss ticks.

## Messaging worker (BullMQ) — run this now

Campaign email/sms **only** run on the messaging worker. `worker:all` no longer consumes those queues.

| Service | Start command | Role |
| --- | --- | --- |
| Messaging Worker | `npm run worker:messaging` | Campaign drain + Brevo/Twilio (`email-send` / `sms-send`) |
| Combined Worker | `npm run worker:all` | Maps + intelligence + reports (safe alongside messaging) |

| Field | Value |
| --- | --- |
| Name | Messaging Worker |
| Start command | `npm run worker:messaging` |
| Domain / port | none |
| Restart | always |

Required env (same as web): `QUEUE_DRIVER=bullmq`, `REDIS_URL`, Supabase keys, `TWILIO_*`, `BREVO_*`.

Queues consumed: `review-campaign`, `email-send`, `sms-send`, `review-import`, `review-monitor`, `notifications`.

Quick Send (one-off SMS/email in the UI) does **not** use these queues — it sends inside the web request. Campaign bulk/drip sends do.

Later: replace `worker:all` with `worker:maps` + `worker:intelligence` + `worker:reports` when you want Maps isolation.

## 1. Set secrets

In Coolify → Application → Environment:

```
CRON_SECRET=<long-random-string>
```

Required in production. Without it, `/api/jobs/process` returns 503.

Also ensure Twilio / Brevo env vars are set for actual delivery.

## 2. Create a Coolify scheduled task (recommended)

Coolify → Project → Scheduled Tasks (or Server → Cron Jobs):

| Field | Value |
|-------|--------|
| Name | `maps-growth-jobs-process` |
| Schedule | `* * * * *` (every minute) |
| Command | see below |

```bash
curl -fsS -X POST \
  -H "Authorization: Bearer ${CRON_SECRET}" \
  -H "Content-Type: application/json" \
  "https://app.localexpress.com/api/jobs/process"
```

Notes:
- Use the **same** `CRON_SECRET` exported in the task environment (Coolify can inject app env into scheduled tasks).
- Prefer the internal / public HTTPS URL of the app on the Hetzner host.
- Every minute is fine; the processor already claim-locks messages so overlapping curls are safe.

## 3. Alternative: host crontab on the Hetzner box

```cron
* * * * * curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://app.localexpress.com/api/jobs/process >> /var/log/maps-jobs-cron.log 2>&1
```

## 4. Verify

```bash
curl -i -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://app.localexpress.com/api/jobs/process
```

Expect JSON like:

```json
{
  "jobsProcessed": 0,
  "campaignSent": 3,
  "scansReclaimed": 0,
  "jobsReclaimed": 0
}
```

Check Coolify logs for `campaign_message_sent` / `jobs_process_complete`.

## 5. Prove overlapping workers cannot double-send

Unit coverage (memory CAS) lives in `src/lib/reputation/campaign-claim.test.ts` — run `npm test`.

Production check (same scheduled messages, two concurrent cron hits):

```bash
# Fire two overlapping process calls against a campaign with queued due messages
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://app.localexpress.com/api/jobs/process" &
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://app.localexpress.com/api/jobs/process" &
wait
```

Full webhook URL cheat-sheet (Twilio + Brevo + cron): `docs/PRODUCTION_WEBHOOKS.md`.

Then verify in logs / DB:
- Each `review_request_messages` row has at most one `provider_message_id`
- Only one `campaign_message_sent` log per message id
- Coolify scheduled-task history shows failed runs (if any curl errors)

Also set `TWILIO_STATUS_CALLBACK_URL` (or rely on `NEXT_PUBLIC_APP_URL` + `/api/webhooks/twilio/sms`) so delivery receipts flip messages to `delivered`.

## 6. End-to-end scheduled campaign smoke test

1. Create a 1–2 recipient SMS campaign + a 1–2 recipient email campaign, start date = today, low daily limit.
2. Confirm Coolify cron runs every minute (`* * * * *`).
3. Watch Coolify logs for `campaign_message_sent`.
4. Confirm Twilio STOP and Brevo inbound still update suppression / replies (push webhooks).
5. Confirm campaign detail shows delivery/click/reply and does not mark completed while recipients are still `waiting` on sequence waits.

## 7. Provider webhooks (push — not cron)

| Provider | Purpose | Endpoint |
|----------|---------|----------|
| Twilio SMS reply / STOP | Inbound + opt-out | `/api/webhooks/twilio/sms` |
| Twilio MessageStatus | Delivered / failed | same URL via `StatusCallback` |
| Brevo inbound | Email replies (plus-address) | `/api/webhooks/brevo/inbound?token=…` |
| Brevo transactional | Delivered / bounce / complaint / unsub | `/api/webhooks/brevo/events?token=…` |

Set `BREVO_EVENTS_WEBHOOK_SECRET` (or reuse `BREVO_INBOUND_WEBHOOK_SECRET`) and configure the Brevo transactional webhook in the Brevo dashboard.

Unsubscribe links: campaign + one-off emails include `List-Unsubscribe` pointing at `/api/reputation/unsubscribe?token=…`.

## 8. What cron also drains

- Campaign sequence waits / reminders (`processSequenceWaits`)
- Contact CSV import jobs (`import_contacts`)
- New-review alert emails (when alert settings have recipients)

## 9. What this does *not* replace

- Twilio / Brevo push webhooks above — cron never substitutes for those
- Live Stripe checkout (intentionally deferred)

## Policy reminder

When billing is inactive or the `review_campaigns` add-on is off, the processor pauses outbound campaign sends and leaves messages queued.
