import { NextResponse } from "next/server";

/**
 * Twilio TrustHub status_callback target for Secondary Customer Profiles /
 * Trust Products. Full Event Streams wiring comes later; this endpoint
 * acknowledges callbacks so registration setup does not 404.
 */
export async function POST(request: Request) {
  try {
    const contentType = request.headers.get("content-type") ?? "";
    let payload: Record<string, unknown> = {};
    if (contentType.includes("application/json")) {
      payload = (await request.json()) as Record<string, unknown>;
    } else {
      const form = await request.formData();
      form.forEach((value, key) => {
        payload[key] = typeof value === "string" ? value : String(value);
      });
    }
    console.info("[twilio/compliance-status]", {
      bundleSid: payload.BundleSid ?? payload.sid ?? null,
      status: payload.Status ?? payload.status ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.warn(
      "[twilio/compliance-status] parse error",
      err instanceof Error ? err.message : err
    );
    return NextResponse.json({ ok: true });
  }
}
