/**
 * Public app origin used for webhooks, tracked links, and unsubscribe URLs.
 * Production default is the live Coolify host once DNS is pointed there.
 */
export const PRODUCTION_APP_URL = "https://app.localexpress.com";

export function getAppBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/\/$/, "")}`;

  if (process.env.NODE_ENV === "production") {
    return PRODUCTION_APP_URL;
  }

  return "http://localhost:3000";
}

/** Absolute URL path on the public app host. */
export function appUrl(path: string): string {
  const base = getAppBaseUrl();
  const normalized = path.startsWith("/") ? path : `/${path}`;
  return `${base}${normalized}`;
}

export const WEBHOOK_PATHS = {
  twilioSms: "/api/webhooks/twilio/sms",
  brevoInbound: "/api/webhooks/brevo/inbound",
  brevoEvents: "/api/webhooks/brevo/events",
  jobsProcess: "/api/jobs/process",
  unsubscribe: "/api/reputation/unsubscribe",
} as const;

export function getTwilioSmsWebhookUrl(): string {
  return (
    process.env.TWILIO_WEBHOOK_URL?.trim() ||
    process.env.TWILIO_STATUS_CALLBACK_URL?.trim() ||
    appUrl(WEBHOOK_PATHS.twilioSms)
  );
}

export function getBrevoInboundWebhookUrl(): string {
  const secret = process.env.BREVO_INBOUND_WEBHOOK_SECRET?.trim();
  const base = appUrl(WEBHOOK_PATHS.brevoInbound);
  return secret ? `${base}?token=${encodeURIComponent(secret)}` : base;
}

export function getBrevoEventsWebhookUrl(): string {
  const secret =
    process.env.BREVO_EVENTS_WEBHOOK_SECRET?.trim() ||
    process.env.BREVO_INBOUND_WEBHOOK_SECRET?.trim();
  const base = appUrl(WEBHOOK_PATHS.brevoEvents);
  return secret ? `${base}?token=${encodeURIComponent(secret)}` : base;
}

export function getJobsCronUrl(): string {
  return appUrl(WEBHOOK_PATHS.jobsProcess);
}
