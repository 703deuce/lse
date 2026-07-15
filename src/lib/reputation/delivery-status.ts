import { createServiceClient } from "@/lib/db/client";
import { logger } from "@/lib/observability/logger";

/**
 * Apply Twilio MessageStatus (or Brevo-equivalent) onto campaign messages.
 * Idempotent: already-clicked rows keep clicked; delivered upgrades sent.
 */
export async function applyProviderDeliveryStatus(params: {
  providerMessageId: string;
  status: string;
  errorCode?: string | null;
}): Promise<boolean> {
  const sid = params.providerMessageId?.trim();
  if (!sid) return false;

  const normalized = params.status.trim().toLowerCase();
  const supabase = createServiceClient();
  const { data: message } = await supabase
    .from("review_request_messages")
    .select("id, status")
    .eq("provider_message_id", sid)
    .maybeSingle();

  if (!message) return false;

  const now = new Date().toISOString();
  const current = String(message.status);

  if (normalized === "delivered") {
    if (current === "clicked" || current === "opted_out") return true;
    await supabase
      .from("review_request_messages")
      .update({
        status: "delivered",
        delivered_at: now,
        updated_at: now,
      })
      .eq("id", message.id)
      .in("status", ["sent", "sending", "delivered"]);
    return true;
  }

  if (normalized === "sent" || normalized === "queued" || normalized === "accepted") {
    return true;
  }

  if (
    normalized === "failed" ||
    normalized === "undelivered" ||
    normalized === "delivery_unknown"
  ) {
    if (["clicked", "delivered", "opted_out"].includes(current)) return true;
    await supabase
      .from("review_request_messages")
      .update({
        status: "failed",
        failed_at: now,
        failed_reason: `provider:${normalized}${params.errorCode ? `:${params.errorCode}` : ""}`,
        error_code: params.errorCode ?? null,
        updated_at: now,
      })
      .eq("id", message.id)
      .in("status", ["sent", "sending", "queued"]);
    logger.info("campaign_message_provider_failed", {
      messageId: message.id,
      providerStatus: normalized,
      errorCode: params.errorCode ?? null,
    });
    return true;
  }

  return false;
}
