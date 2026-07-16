import { NextResponse } from "next/server";
import { authorizeHeaderSecret } from "@/lib/security/secrets";
import { logger } from "@/lib/observability/logger";

/**
 * Google Business Profile / PubSub push notifications.
 * Requires GOOGLE_NOTIFICATIONS_WEBHOOK_SECRET via header (no query tokens).
 */
export async function POST(request: Request) {
  const authz = authorizeHeaderSecret(
    request,
    process.env.GOOGLE_NOTIFICATIONS_WEBHOOK_SECRET,
    { allowMissingInDev: true }
  );
  if (!authz.ok) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Acknowledge without logging raw payload (may contain account data).
  await request.json().catch(() => ({}));
  logger.info("google_notifications_webhook_received", { ok: true });
  return NextResponse.json({ received: true });
}
