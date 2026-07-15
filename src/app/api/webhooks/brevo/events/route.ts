import { NextResponse } from "next/server";
import {
  handleBrevoTransactionalEvent,
  parseBrevoEventPayload,
} from "@/lib/reputation/brevo-events";
import { logger } from "@/lib/observability/logger";

function verifyWebhookToken(request: Request): boolean {
  const secret =
    process.env.BREVO_EVENTS_WEBHOOK_SECRET?.trim() ||
    process.env.BREVO_INBOUND_WEBHOOK_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const url = new URL(request.url);
  const header = request.headers.get("x-brevo-token") ?? request.headers.get("authorization");
  if (header === secret || header === `Bearer ${secret}`) return true;
  return url.searchParams.get("token") === secret;
}

export async function POST(request: Request) {
  if (!verifyWebhookToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const events = parseBrevoEventPayload(body);
    let handled = 0;
    for (const event of events) {
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
