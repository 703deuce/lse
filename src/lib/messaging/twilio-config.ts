import { cleanSecret } from "@/lib/env/secrets";

/** Secondary Customer Profile policy (TrustHub). Do not change. */
export const TWILIO_SECONDARY_CUSTOMER_PROFILE_POLICY_SID =
  "RNdfbf3fae0e1107f8aded0e7cead80bf5";

/** A2P Messaging Trust Product policy. Do not change. */
export const TWILIO_A2P_TRUST_PRODUCT_POLICY_SID =
  "RNb0d4771c2c98518d916a3d4cd70a8f8b";

export type TwilioParentCredentials =
  | { mode: "authToken"; accountSid: string; authToken: string }
  | {
      mode: "apiKey";
      accountSid: string;
      apiKeySid: string;
      apiKeySecret: string;
    };

/**
 * Live messaging adapter is enabled when Coolify has ISV credentials and
 * TWILIO_MODE=live (or MESSAGING_ADAPTER=twilio).
 *
 * Auth note: this app already uses TWILIO_AUTH_TOKEN as the API Key secret when
 * TWILIO_API_KEY_SID is set. For TrustHub / subaccounts, prefer
 * TWILIO_ACCOUNT_AUTH_TOKEN (console Auth Token).
 */
export function isLiveTwilioMessaging(): boolean {
  const mode = (process.env.TWILIO_MODE ?? "").trim().toLowerCase();
  const adapter = (process.env.MESSAGING_ADAPTER ?? "").trim().toLowerCase();
  if (mode === "mock" || adapter === "mock") return false;
  if (mode !== "live" && adapter !== "twilio") return false;
  return getTwilioParentCredentials() !== null && Boolean(getTwilioPrimaryProfileSid());
}

export function getTwilioPrimaryProfileSid(): string | null {
  const sid = cleanSecret(process.env.TWILIO_PRIMARY_PROFILE_SID);
  return sid?.startsWith("BU") ? sid : null;
}

export function getTwilioStatusEmail(): string {
  return (
    cleanSecret(process.env.TWILIO_STATUS_EMAIL) ||
    cleanSecret(process.env.MESSAGING_STATUS_EMAIL) ||
    "compliance@localseoexpress.com"
  );
}

export function getTwilioComplianceStatusCallbackUrl(): string | undefined {
  const base =
    cleanSecret(process.env.TWILIO_STATUS_CALLBACK_BASE_URL) ||
    cleanSecret(process.env.APP_URL) ||
    cleanSecret(process.env.NEXT_PUBLIC_APP_URL);
  if (!base) return undefined;
  return `${base.replace(/\/$/, "")}/api/twilio/compliance-status`;
}

export function getTwilioParentCredentials(): TwilioParentCredentials | null {
  const accountSid = cleanSecret(process.env.TWILIO_ACCOUNT_SID);
  if (!accountSid?.startsWith("AC")) return null;

  const accountAuthToken =
    cleanSecret(process.env.TWILIO_ACCOUNT_AUTH_TOKEN) ||
    cleanSecret(process.env.TWILIO_PARENT_AUTH_TOKEN) ||
    cleanSecret(process.env.TWILIO_WEBHOOK_AUTH_TOKEN);

  if (accountAuthToken) {
    return { mode: "authToken", accountSid, authToken: accountAuthToken };
  }

  const apiKeySid = cleanSecret(process.env.TWILIO_API_KEY_SID);
  const apiKeySecret = cleanSecret(process.env.TWILIO_AUTH_TOKEN);
  if (apiKeySid?.startsWith("SK") && apiKeySecret) {
    return { mode: "apiKey", accountSid, apiKeySid, apiKeySecret };
  }

  // User docs / Coolify: TWILIO_AUTH_TOKEN as Account Auth Token when no API key.
  if (apiKeySecret && !apiKeySid) {
    return { mode: "authToken", accountSid, authToken: apiKeySecret };
  }

  return null;
}
