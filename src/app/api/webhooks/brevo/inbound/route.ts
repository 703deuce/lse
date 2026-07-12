import { NextResponse } from "next/server";
import { parseBrevoInboundPayload } from "@/lib/reputation/inbound-reply";
import { handleBrevoInboundEmail } from "@/lib/reputation/review-sends";

function verifyWebhookToken(request: Request): boolean {
  const secret = process.env.BREVO_INBOUND_WEBHOOK_SECRET?.trim();
  if (!secret) return true;
  const url = new URL(request.url);
  return url.searchParams.get("token") === secret;
}

export async function POST(request: Request) {
  if (!verifyWebhookToken(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const items = parseBrevoInboundPayload(body);
    const results = [];

    for (const item of items) {
      if (!item.replyBody && !item.sendId && !item.fromEmail) continue;
      const result = await handleBrevoInboundEmail(item);
      results.push(result);
    }

    return NextResponse.json({ ok: true, processed: results.length, results });
  } catch (err) {
    console.error("[brevo/inbound webhook]", err);
    return NextResponse.json({ ok: true, processed: 0 });
  }
}
