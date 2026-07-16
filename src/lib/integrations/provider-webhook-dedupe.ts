import { createServiceClient } from "@/lib/db/client";

/**
 * Insert-once dedupe for Twilio/Brevo webhook deliveries.
 * Returns true when this is the first time we have seen the key.
 */
export async function claimProviderWebhookEvent(params: {
  provider: "twilio" | "brevo";
  idempotencyKey: string;
  meta?: Record<string, unknown>;
}): Promise<boolean> {
  const supabase = createServiceClient();
  const { error } = await supabase.from("provider_webhook_events").insert({
    provider: params.provider,
    idempotency_key: params.idempotencyKey,
    meta: params.meta ?? {},
  });
  if (!error) return true;
  if (error.code === "23505" || /duplicate|unique/i.test(error.message)) {
    return false;
  }
  // Table missing / transient — proceed (best-effort) so delivery is not dropped.
  return true;
}
