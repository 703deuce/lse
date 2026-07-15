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

## 5. What this does *not* replace

- Twilio delivery / inbound webhooks still hit `/api/webhooks/twilio/sms`
- Brevo inbound replies still hit `/api/webhooks/brevo/inbound`
- Those are push callbacks, not cron

## Policy reminder

When billing is inactive or the `review_campaigns` add-on is off, the processor pauses outbound campaign sends and leaves messages queued.
