/**
 * Public app origin used for webhooks, tracked links, and unsubscribe URLs.
 * Production default is the live Coolify host once DNS is pointed there.
 *
 * NOTE: This must match the real public hostname. A wrong default (e.g. the
 * legacy typo `app.localexpress.com`) causes CSRF middleware to reject every
 * cookie-authenticated Run/POST from the browser when APP_URL is unset.
 */
export const PRODUCTION_APP_URL = "https://app.localseoexpress.com";

/** Known public origins always accepted in production (env may be mis-set). */
export const BUILTIN_PRODUCTION_ORIGINS = [
  "https://app.localseoexpress.com",
  // Legacy hostname that appears in older Coolify / webhook docs.
  "https://app.localexpress.com",
] as const;

/** True when a base URL is localhost / private / container-only (not client-shareable). */
export function isNonPublicAppBase(baseUrl: string): boolean {
  try {
    const host = new URL(baseUrl).hostname.toLowerCase();
    if (
      host === "localhost" ||
      host === "127.0.0.1" ||
      host === "0.0.0.0" ||
      host === "::1" ||
      host.endsWith(".local") ||
      host.endsWith(".internal") ||
      host.endsWith(".localhost")
    ) {
      return true;
    }
    // RFC1918 + link-local
    if (/^10\.\d+\.\d+\.\d+$/.test(host)) return true;
    if (/^192\.168\.\d+\.\d+$/.test(host)) return true;
    if (/^172\.(1[6-9]|2\d|3[0-1])\.\d+\.\d+$/.test(host)) return true;
    if (/^169\.254\.\d+\.\d+$/.test(host)) return true;
    return false;
  } catch {
    return true;
  }
}

export function getAppBaseUrl(): string {
  const fromEnv =
    process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (fromEnv) {
    const cleaned = fromEnv.replace(/\/$/, "");
    // Production share links must never use container/localhost hosts even if
    // Coolify APP_URL was pointed at an internal service URL by mistake.
    if (process.env.NODE_ENV === "production" && isNonPublicAppBase(cleaned)) {
      return PRODUCTION_APP_URL;
    }
    return cleaned;
  }

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

/** Client-facing shareable report URL (always public absolute). */
export function publicReportShareUrl(shareToken: string): string {
  const token = shareToken.trim().replace(/^\/+/, "");
  return appUrl(`/reports/share/${token}`);
}

export const WEBHOOK_PATHS = {
  twilioSms: "/api/webhooks/twilio/sms",
  brevoInbound: "/api/webhooks/brevo/inbound",
  brevoEvents: "/api/webhooks/brevo/events",
  automation: "/api/webhooks/automation",
  jobsProcess: "/api/jobs/process",
  unsubscribe: "/api/reputation/unsubscribe",
} as const;

export function getAutomationWebhookUrl(): string {
  return appUrl(WEBHOOK_PATHS.automation);
}

export function getTwilioSmsWebhookUrl(): string {
  return (
    process.env.TWILIO_WEBHOOK_URL?.trim() ||
    process.env.TWILIO_STATUS_CALLBACK_URL?.trim() ||
    appUrl(WEBHOOK_PATHS.twilioSms)
  );
}

/** Brevo must authenticate with `x-brevo-token` / Bearer header — never put secrets in the URL. */
export function getBrevoInboundWebhookUrl(): string {
  return appUrl(WEBHOOK_PATHS.brevoInbound);
}

/** Brevo must authenticate with `x-brevo-token` / Bearer header — never put secrets in the URL. */
export function getBrevoEventsWebhookUrl(): string {
  return appUrl(WEBHOOK_PATHS.brevoEvents);
}

export function getJobsCronUrl(): string {
  return appUrl(WEBHOOK_PATHS.jobsProcess);
}
