import { NextResponse } from "next/server";
import { sendBrevoEmail } from "@/lib/reputation/brevo";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { httpErrorFromException } from "@/lib/security/http-errors";

const MARKETING_ORIGINS = new Set([
  "https://localseoexpress.com",
  "https://www.localseoexpress.com",
  "http://127.0.0.1:4173",
  "http://localhost:4173",
  "http://127.0.0.1:8765",
  "http://localhost:8765",
]);

const INQUIRY_TO =
  process.env.CONTACT_INQUIRY_TO_EMAIL?.trim() || "info@localseoexpress.com";

/** Prefer a dedicated contact sender; fall back to review-request From. */
function contactFromName(): string | undefined {
  return (
    process.env.CONTACT_FROM_NAME?.trim() ||
    process.env.REVIEW_REQUEST_FROM_NAME?.trim() ||
    "Local SEO Express Website"
  );
}

function corsHeaders(origin: string | null): HeadersInit {
  const allowed =
    origin && MARKETING_ORIGINS.has(origin) ? origin : "https://localseoexpress.com";
  return {
    "Access-Control-Allow-Origin": allowed,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
    "Cross-Origin-Resource-Policy": "cross-origin",
    Vary: "Origin",
  };
}

function clean(value: unknown, max = 500): string {
  if (typeof value !== "string") return "";
  return value.trim().slice(0, max);
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const headers = corsHeaders(origin);

  try {
    const ip =
      request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
      request.headers.get("x-real-ip") ??
      "unknown";
    const rate = await assertRateLimit({
      key: `public-contact:${ip}`,
      maxPerWindow: 5,
      windowMs: 60 * 60 * 1000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many inquiries from this network. Try again later." },
        { status: 429, headers },
      );
    }

    const body = (await request.json()) as Record<string, unknown>;

    // Honeypot — bots fill hidden fields; humans leave this empty.
    if (clean(body.company_website, 200)) {
      return NextResponse.json({ ok: true }, { headers });
    }

    const firstName = clean(body.first_name, 80);
    const lastName = clean(body.last_name, 80);
    const businessName = clean(body.business_name, 160);
    const email = clean(body.email, 160);
    const phone = clean(body.phone, 40);
    const website = clean(body.website, 300);
    const primaryService = clean(body.primary_service, 120);
    const location = clean(body.location, 120);
    const locations = clean(body.locations, 40);
    const improve = clean(body.improve, 80);
    const message = clean(body.message, 4000);

    if (!firstName || !lastName || !businessName || !email) {
      return NextResponse.json(
        { error: "First name, last name, business name, and email are required." },
        { status: 400, headers },
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json(
        { error: "Enter a valid email address." },
        { status: 400, headers },
      );
    }

    const fullName = `${firstName} ${lastName}`;
    const textBody = [
      "New free SEO audit request from localseoexpress.com/contact/",
      "",
      `Name: ${fullName}`,
      `Business: ${businessName}`,
      `Email: ${email}`,
      `Phone: ${phone || "—"}`,
      `Website: ${website || "—"}`,
      `Primary service: ${primaryService || "—"}`,
      `Service area: ${location || "—"}`,
      `Locations: ${locations || "—"}`,
      `Wants to improve: ${improve || "—"}`,
      "",
      "Additional information:",
      message || "—",
    ].join("\n");

    const sent = await sendBrevoEmail({
      toEmail: INQUIRY_TO,
      toName: "Local SEO Express",
      fromName: contactFromName(),
      replyToEmail: email,
      subject: `Free SEO audit request — ${businessName}`,
      textBody,
      idempotencyKey: `contact:${ip}:${email}:${Date.now()}`,
    });

    if (!sent.ok) {
      return NextResponse.json(
        {
          error:
            "We couldn't send your request right now. Email info@localseoexpress.com and we'll help you.",
        },
        { status: 502, headers },
      );
    }

    return NextResponse.json({ ok: true }, { headers });
  } catch (err) {
    const res = httpErrorFromException(err, "Failed to submit contact form");
    for (const [key, value] of Object.entries(headers)) {
      res.headers.set(key, value);
    }
    return res;
  }
}
