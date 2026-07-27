import { NextResponse } from "next/server";
import { generateReviewResponseDraft } from "@/lib/providers/deepseek/reputation";

export const runtime = "nodejs";

const TONES = new Set(["professional", "friendly", "grateful", "concise"]);

function corsHeaders(origin: string | null) {
  const allowed = new Set([
    "https://localseoexpress.com",
    "https://www.localseoexpress.com",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
  ]);
  const value =
    origin && (allowed.has(origin) || origin.endsWith(".localseoexpress.com"))
      ? origin
      : "https://localseoexpress.com";
  return {
    "Access-Control-Allow-Origin": value,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

export async function OPTIONS(request: Request) {
  return new NextResponse(null, {
    status: 204,
    headers: corsHeaders(request.headers.get("origin")),
  });
}

export async function POST(request: Request) {
  const headers = corsHeaders(request.headers.get("origin"));
  try {
    const body = (await request.json()) as {
      reviewText?: string;
      businessName?: string;
      tone?: string;
      rating?: number | null;
    };

    const reviewText = String(body.reviewText ?? "").trim();
    const businessName = String(body.businessName ?? "").trim() || "Our business";
    const tone = String(body.tone ?? "professional").trim().toLowerCase();
    const rating =
      typeof body.rating === "number" && body.rating >= 1 && body.rating <= 5
        ? body.rating
        : null;

    if (reviewText.length < 8) {
      return NextResponse.json(
        { error: "Paste a customer review (at least a short sentence)." },
        { status: 400, headers }
      );
    }
    if (reviewText.length > 4000) {
      return NextResponse.json(
        { error: "Review text is too long." },
        { status: 400, headers }
      );
    }
    if (!TONES.has(tone)) {
      return NextResponse.json({ error: "Invalid tone." }, { status: 400, headers });
    }

    const drafted = await generateReviewResponseDraft({
      businessName,
      reviewText: `Tone: ${tone}.\n\n${reviewText}`,
      rating,
    });

    const reply =
      drafted?.trim() ||
      `Thank you for taking the time to share your experience with ${businessName}. We truly appreciate your feedback and hope to see you again soon.`;

    return NextResponse.json({ reply, tone }, { headers });
  } catch {
    return NextResponse.json(
      { error: "Could not generate a reply right now." },
      { status: 500, headers }
    );
  }
}
