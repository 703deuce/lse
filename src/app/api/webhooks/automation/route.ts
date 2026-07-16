import { NextResponse } from "next/server";
import {
  AUTOMATION_ACTIONS,
  dispatchAutomationWebhook,
} from "@/lib/automations/dispatch";
import {
  extractApiKeyFromRequest,
  verifyApiKey,
} from "@/lib/auth/api-keys";
import { appUrl } from "@/lib/app-url";
import { logger } from "@/lib/observability/logger";

/**
 * First-class inbound automation webhook for Zapier / Make / n8n / custom scripts.
 *
 * Auth: Authorization: Bearer lse_…   or   X-API-Key: lse_…
 * Body: { action, businessId, campaignId?, contact fields… }
 */
export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "localexpress-automation",
    endpoint: appUrl("/api/webhooks/automation"),
    actions: AUTOMATION_ACTIONS,
    auth: ["Authorization: Bearer <api_key>", "X-API-Key: <api_key>"],
    docs: "/docs/AUTOMATION_WEBHOOKS.md",
  });
}

export async function POST(request: Request) {
  try {
    const rawKey = extractApiKeyFromRequest(request);
    if (!rawKey) {
      return NextResponse.json(
        { error: "Missing API key (Authorization Bearer or X-API-Key)" },
        { status: 401 }
      );
    }

    const key = await verifyApiKey(rawKey);
    if (!key) {
      return NextResponse.json({ error: "Invalid or revoked API key" }, { status: 401 });
    }

    let body: Record<string, unknown> = {};
    try {
      const parsed = await request.json();
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        body = parsed as Record<string, unknown>;
      }
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const result = await dispatchAutomationWebhook({ key, body });
    if (!result.ok) {
      return NextResponse.json(
        { ok: false, action: result.action, error: result.error, ...(result.data ?? {}) },
        { status: result.status }
      );
    }

    return NextResponse.json({
      ok: true,
      action: result.action,
      ...(result.data ?? {}),
    });
  } catch (err) {
    logger.error("automation_webhook_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({ error: "Automation webhook failed" }, { status: 500 });
  }
}
