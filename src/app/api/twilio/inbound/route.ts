/**
 * Messaging Service inbound webhook (per-customer subaccounts).
 * Reuses the shared Twilio SMS webhook handler.
 */
export { POST } from "@/app/api/webhooks/twilio/sms/route";
