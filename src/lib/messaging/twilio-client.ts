import twilio from "twilio";
import type { Twilio } from "twilio";
import {
  getTwilioParentCredentials,
  type TwilioParentCredentials,
} from "./twilio-config";

export type TwilioClient = Twilio;

export function createParentTwilioClient(
  credentials: TwilioParentCredentials = getTwilioParentCredentials()!
): TwilioClient {
  if (!credentials) {
    throw new Error(
      "Twilio parent credentials are not configured. Set TWILIO_ACCOUNT_SID and TWILIO_ACCOUNT_AUTH_TOKEN (or API key pair)."
    );
  }
  if (credentials.mode === "authToken") {
    return twilio(credentials.accountSid, credentials.authToken);
  }
  return twilio(credentials.apiKeySid, credentials.apiKeySecret, {
    accountSid: credentials.accountSid,
  });
}

export function createSubaccountTwilioClient(
  subaccountSid: string,
  authToken: string
): TwilioClient {
  if (!subaccountSid.startsWith("AC")) {
    throw new Error("Invalid Twilio subaccount SID");
  }
  if (!authToken) {
    throw new Error("Missing Twilio subaccount auth token");
  }
  return twilio(subaccountSid, authToken);
}
