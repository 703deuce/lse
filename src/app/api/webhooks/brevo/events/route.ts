import { NextResponse } from "next/server";
import {
  handleBrevoTransactionalEvent,
  parseBrevoEventPayload,
} from "@/lib/reputation/brevo-events";
import { logger } from "@/lib/observability/logger";
import { claimProviderWebhookEvent } from "@/lib/integrations/provider-webhook-dedupe";
import { authorizeHeaderSecret } from "@/lib/security/secrets";

export async function POST(request: Request) {
  const secret =
    process.env.BREVO_EVENTS_WEBHOOK_SECRET?.trim() ||
    process.env.BREVO_INBOUND_WEBHOOK_SECRET?.trim();
  const authz = authorizeHeaderSecret(request, secret);
  if (!authz.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const events = parseBrevoEventPayload(body);
    let handled = 0;
    for (const event of events) {
      const messageId = String(event["message-id"] ?? event.messageId ?? "unknown");
      const eventName = String(event.event ?? event.event_name ?? "event");
      const eventKey = [
        messageId,
        eventName,
        String(event.date ?? event.ts ?? ""),
        String(event.email ?? ""),
      ].join(":");
      const claimed = await claimProviderWebhookEvent({
        provider: "brevo",
        idempotencyKey: `brevo:event:${eventKey}`,
        meta: { event: eventName, messageId },
      });
      if (!claimed) continue;
      const result = await handleBrevoTransactionalEvent(event);
      if (result.handled) handled++;
    }
    return NextResponse.json({ ok: true, received: events.length, handled });
  } catch (err) {
    logger.error("brevo_events_webhook_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ ok: true, received: 0, handled: 0 });
  }
}
