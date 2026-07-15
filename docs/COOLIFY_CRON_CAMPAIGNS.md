# Coolify / Hetzner — Review Campaigns cron

Campaign SMS/email sends do **not** run inside long HTTP browser requests.
They are drained by the existing job poller:

`GET|POST /api/jobs/process`

That route calls `processPendingJobs()` which:
1. Reclaims stale scan / job-queue work
2. Runs `processCampaignMessages()` (atomic claim → Twilio/Brevo → mark sent)

On Coolify (Hetzner), schedule an **external cron** (or Coolify Scheduled Task) that hits your public app URL. Do not rely on `node-cron` inside the Next.js process — deploys and restarts would miss ticks.

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
  "https://YOUR_DOMAIN/api/jobs/process"
```

Notes:
- Use the **same** `CRON_SECRET` exported in the task environment (Coolify can inject app env into scheduled tasks).
- Prefer the internal / public HTTPS URL of the app on the Hetzner host.
- Every minute is fine; the processor already claim-locks messages so overlapping curls are safe.

## 3. Alternative: host crontab on the Hetzner box

```cron
* * * * * curl -fsS -X POST -H "Authorization: Bearer YOUR_CRON_SECRET" https://YOUR_DOMAIN/api/jobs/process >> /var/log/maps-jobs-cron.log 2>&1
```

## 4. Verify

```bash
curl -i -X POST \
  -H "Authorization: Bearer $CRON_SECRET" \
  https://YOUR_DOMAIN/api/jobs/process
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
  "https://YOUR_DOMAIN/api/jobs/process" &
curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" \
  "https://YOUR_DOMAIN/api/jobs/process" &
wait
```

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

## 7. What this does *not* replace

- Twilio delivery / inbound webhooks still hit `/api/webhooks/twilio/sms`
- Brevo inbound replies still hit `/api/webhooks/brevo/inbound`
- Those are push callbacks, not cron

## Policy reminder

When billing is inactive or the `review_campaigns` add-on is off, the processor pauses outbound campaign sends and leaves messages queued.
