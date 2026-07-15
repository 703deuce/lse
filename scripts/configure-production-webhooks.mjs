#!/usr/bin/env node
/**
 * Point Twilio's SMS number at the live app host and print Coolify/Brevo URLs.
 *
 * Usage (with Coolify/Twilio env loaded):
 *   node scripts/configure-production-webhooks.mjs
 *
 * Requires:
 *   TWILIO_ACCOUNT_SID, TWILIO_API_KEY_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER
 * Optional:
 *   NEXT_PUBLIC_APP_URL (defaults to https://app.localexpress.com)
 */

const APP_URL = (process.env.NEXT_PUBLIC_APP_URL || "https://app.localexpress.com").replace(
  /\/$/,
  ""
);
const TWILIO_SMS_WEBHOOK =
  process.env.TWILIO_WEBHOOK_URL?.trim() || `${APP_URL}/api/webhooks/twilio/sms`;

function authHeader() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const apiKeySid = process.env.TWILIO_API_KEY_SID;
  const apiKeySecret = process.env.TWILIO_AUTH_TOKEN;
  if (!accountSid?.startsWith("AC") || !apiKeySid?.startsWith("SK") || !apiKeySecret) {
    throw new Error("Missing TWILIO_ACCOUNT_SID / TWILIO_API_KEY_SID / TWILIO_AUTH_TOKEN");
  }
  return {
    accountSid,
    authorization: `Basic ${Buffer.from(`${apiKeySid}:${apiKeySecret}`).toString("base64")}`,
  };
}

async function findPhoneSid(accountSid, authorization, fromNumber) {
  const url = new URL(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers.json`);
  url.searchParams.set("PhoneNumber", fromNumber);
  const res = await fetch(url, { headers: { Authorization: authorization } });
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Twilio list failed: ${res.status}`);
  const row = json.incoming_phone_numbers?.[0];
  if (!row?.sid) throw new Error(`No IncomingPhoneNumber found for ${fromNumber}`);
  return row.sid;
}

async function updatePhoneWebhook(accountSid, authorization, phoneSid) {
  const body = new URLSearchParams({
    SmsUrl: TWILIO_SMS_WEBHOOK,
    SmsMethod: "POST",
    StatusCallback: TWILIO_SMS_WEBHOOK,
    StatusCallbackMethod: "POST",
  });
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/IncomingPhoneNumbers/${phoneSid}.json`,
    {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: body.toString(),
    }
  );
  const json = await res.json();
  if (!res.ok) throw new Error(json.message || `Twilio update failed: ${res.status}`);
  return json;
}

function printChecklist() {
  const inboundSecret = process.env.BREVO_INBOUND_WEBHOOK_SECRET?.trim();
  const eventsSecret =
    process.env.BREVO_EVENTS_WEBHOOK_SECRET?.trim() || inboundSecret || "";
  const cronSecret = process.env.CRON_SECRET?.trim();

  console.log("\n=== Production webhook URLs (app.localexpress.com) ===\n");
  console.log(`App URL:              ${APP_URL}`);
  console.log(`Twilio SMS + status:  ${TWILIO_SMS_WEBHOOK}`);
  console.log(
    `Brevo inbound:        ${APP_URL}/api/webhooks/brevo/inbound${
      inboundSecret ? `?token=${inboundSecret}` : "?token=YOUR_BREVO_INBOUND_WEBHOOK_SECRET"
    }`
  );
  console.log(
    `Brevo events:         ${APP_URL}/api/webhooks/brevo/events${
      eventsSecret ? `?token=${eventsSecret}` : "?token=YOUR_BREVO_EVENTS_WEBHOOK_SECRET"
    }`
  );
  console.log(`Coolify cron target:  ${APP_URL}/api/jobs/process`);
  console.log(
    `Coolify cron command: curl -fsS -X POST -H "Authorization: Bearer ${
      cronSecret || "$CRON_SECRET"
    }" ${APP_URL}/api/jobs/process`
  );
  console.log("\nCoolify scheduled task: * * * * * (every minute)");
  console.log("Brevo: paste inbound + transactional event URLs in the Brevo dashboard.\n");
}

async function main() {
  printChecklist();

  const fromNumber = process.env.TWILIO_FROM_NUMBER?.trim();
  if (!fromNumber) {
    console.log("TWILIO_FROM_NUMBER unset — skipped Twilio number update.");
    return;
  }

  const { accountSid, authorization } = authHeader();
  const phoneSid = await findPhoneSid(accountSid, authorization, fromNumber);
  const updated = await updatePhoneWebhook(accountSid, authorization, phoneSid);
  console.log(`Updated Twilio number ${fromNumber} (${phoneSid})`);
  console.log(`  SmsUrl: ${updated.sms_url}`);
  console.log(`  StatusCallback: ${updated.status_callback}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
