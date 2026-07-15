# Production webhooks — `https://app.localexpress.com`

The app already exposes the webhook routes. What was missing on localhost was a
public HTTPS URL providers could call. On Coolify with `app.localexpress.com`
you can finish the wiring in three places.

## 1. Coolify env (required)

```
NEXT_PUBLIC_APP_URL=https://app.localexpress.com
CRON_SECRET=<long-random>
TWILIO_WEBHOOK_URL=https://app.localexpress.com/api/webhooks/twilio/sms
TWILIO_STATUS_CALLBACK_URL=https://app.localexpress.com/api/webhooks/twilio/sms
TWILIO_ACCOUNT_AUTH_TOKEN=<Twilio Account Auth Token for signature validation>
BREVO_INBOUND_WEBHOOK_SECRET=<shared secret>
BREVO_EVENTS_WEBHOOK_SECRET=<shared secret or same as inbound>
REVIEW_REQUEST_REPLY_DOMAIN=reply.localexpress.com   # if you use plus-address replies
```

Outbound SMS automatically attach `StatusCallback` to the Twilio SMS webhook URL
(via `NEXT_PUBLIC_APP_URL` / `TWILIO_*` — see `src/lib/app-url.ts`).

## 2. Coolify scheduled task (campaign worker)

| Field | Value |
|-------|--------|
| Schedule | `* * * * *` |
| Command | `curl -fsS -X POST -H "Authorization: Bearer $CRON_SECRET" https://app.localexpress.com/api/jobs/process` |

This drains campaign SMS/email, sequence waits, imports, and review alerts.

## 3. Twilio Console (or script)

**Phone number → Messaging → A message comes in**

- URL: `https://app.localexpress.com/api/webhooks/twilio/sms`
- Method: `HTTP POST`

Or from a shell with Twilio env loaded:

```bash
node scripts/configure-production-webhooks.mjs
```

That sets the Incoming Phone Number `SmsUrl` + status callback to the live host
and prints the Brevo / Coolify URLs.

## 4. Brevo dashboard

| Webhook | URL |
|---------|-----|
| Inbound parse | `https://app.localexpress.com/api/webhooks/brevo/inbound?token=$BREVO_INBOUND_WEBHOOK_SECRET` |
| Transactional (delivered / bounce / complaint / unsubscribed) | `https://app.localexpress.com/api/webhooks/brevo/events?token=$BREVO_EVENTS_WEBHOOK_SECRET` |

## Why this is not “automatic” from git alone

| Piece | In the repo already? | Needs external click/API? |
|-------|----------------------|---------------------------|
| Next.js webhook routes | Yes | No |
| StatusCallback on each SMS send | Yes | Needs correct `NEXT_PUBLIC_APP_URL` in Coolify |
| Coolify every-minute cron | Docs + env | Create the scheduled task in Coolify UI |
| Twilio phone inbound URL | Script can set via API | Or paste once in Twilio Console |
| Brevo inbound/events URLs | Docs | May need Brevo Dashboard once (API varies by plan) |

After Coolify has the env + cron, and Twilio/Brevo point at the URLs above,
campaign callbacks are live — no localhost tunneling required.
