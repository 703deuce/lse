import { NextResponse } from "next/server";
import { sendBrevoEmail } from "@/lib/reputation/brevo";
import { publicToolCorsHeaders } from "@/lib/public/cors";
import { assertRateLimit } from "@/lib/security/rate-limit";

export const runtime = "nodejs";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: publicToolCorsHeaders(request.headers.get("origin")),
  });
}

/** Email the free QR package (link + download instructions) before final delivery. */
export async function POST(request: Request) {
  const headers = publicToolCorsHeaders(request.headers.get("origin"));
  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await assertRateLimit({
      key: `public-qr-email:${ip}`,
      maxPerWindow: 6,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many emails from this network. Try again later." },
        { status: 429, headers }
      );
    }

    const body = (await request.json()) as {
      email?: string;
      businessName?: string;
      reviewLink?: string;
      shortCode?: string;
    };

    const email = String(body.email ?? "").trim().toLowerCase();
    const businessName = String(body.businessName ?? "").trim() || "Your business";
    const reviewLink = String(body.reviewLink ?? "").trim();

    if (!EMAIL_RE.test(email)) {
      return NextResponse.json({ error: "Enter a valid email address." }, { status: 400, headers });
    }
    if (!reviewLink) {
      return NextResponse.json(
        { error: "Generate your review link first." },
        { status: 400, headers }
      );
    }

    const appBase =
      process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://app.localseoexpress.com";
    const signupUrl = `${appBase}/sign-up`;

    const sent = await sendBrevoEmail({
      toEmail: email,
      toName: businessName,
      fromName: "Local SEO Express",
      subject: `Your Google review link & QR for ${businessName}`,
      textBody: [
        `Here's your Google review package for ${businessName}.`,
        "",
        `Direct Google review link:`,
        reviewLink,
        "",
        `Open the free generator again anytime to download your printable QR poster:`,
        `${appBase}/tools/google-review-link-qr-code`,
        "",
        `Printing tip: use Letter or A4, full color, and place the poster where customers wait or check out.`,
        "",
        `Want automatic SMS/email review requests and tracking?`,
        `Create your free account: ${signupUrl}`,
        "",
        `— Local SEO Express`,
      ].join("\n"),
    });

    if (!sent.ok) {
      // Still unlock download on the client even if email provider is misconfigured —
      // return a soft warning so the funnel is not blocked in local/dev.
      return NextResponse.json(
        {
          ok: true,
          emailed: false,
          warning: sent.error || "Email could not be sent right now. You can still download.",
        },
        { headers }
      );
    }

    return NextResponse.json({ ok: true, emailed: true }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Could not email your package right now." },
      { status: 500, headers }
    );
  }
}
