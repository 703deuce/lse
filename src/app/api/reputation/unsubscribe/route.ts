import { NextResponse } from "next/server";
import {
  applyEmailUnsubscribe,
  verifyUnsubscribeToken,
} from "@/lib/reputation/unsubscribe";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") ?? "";
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) {
    return new NextResponse("Invalid or expired unsubscribe link.", { status: 400 });
  }
  const result = await applyEmailUnsubscribe(parsed.messageId);
  if (!result.ok) {
    return new NextResponse("Unable to unsubscribe this address.", { status: 404 });
  }
  return new NextResponse(
    "<!doctype html><html><body style=\"font-family:system-ui;padding:2rem\"><h1>Unsubscribed</h1><p>You will no longer receive review request emails from this business.</p></body></html>",
    { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } }
  );
}

/** One-click List-Unsubscribe-Post (RFC 8058). */
export async function POST(request: Request) {
  const url = new URL(request.url);
  let token = url.searchParams.get("token") ?? "";
  if (!token) {
    try {
      const form = await request.formData();
      token = String(form.get("token") ?? "");
    } catch {
      /* body optional */
    }
  }
  const parsed = verifyUnsubscribeToken(token);
  if (!parsed) {
    return NextResponse.json({ error: "Invalid token" }, { status: 400 });
  }
  const result = await applyEmailUnsubscribe(parsed.messageId);
  if (!result.ok) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ ok: true });
}
