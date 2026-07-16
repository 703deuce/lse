import { NextResponse } from "next/server";
import { ingestIncomingWebhook } from "@/lib/integrations/webhook-ingest";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

function clientIp(request: Request): string | null {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    null
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ endpointToken: string }> }
) {
  try {
    const { endpointToken } = await params;
    const rawBody = await request.text();
    const result = await ingestIncomingWebhook({
      endpointToken: decodeURIComponent(endpointToken),
      rawBody,
      contentType: request.headers.get("content-type"),
      headers: request.headers,
      sourceIp: clientIp(request),
    });

    const res = NextResponse.json(result.body, { status: result.status });
    if (result.headers) {
      for (const [k, v] of Object.entries(result.headers)) res.headers.set(k, v);
    }
    return res;
  } catch (err) {
    logger.error("incoming_webhook_route_error", {
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json(
      { accepted: false, error: "Temporarily unavailable" },
      { status: 503 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "localexpress-incoming-webhook",
    hint: "POST JSON events to this URL. See Integrations → Webhooks in the app.",
  });
}
