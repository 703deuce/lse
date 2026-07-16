import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { researchSchema } from "@/lib/validation/schemas";
import { groundedResearch } from "@/lib/providers/gemini";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { httpErrorFromException } from "@/lib/security/http-errors";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const rate = assertRateLimit({
      key: `research:${auth.organizationId}`,
      maxPerWindow: 20,
      windowMs: 60_000,
    });
    if (!rate.ok) {
      return NextResponse.json(
        { error: "Too many requests" },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rate.retryAfterMs / 1000)) },
        }
      );
    }

    const body = await request.json();
    const parsed = researchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await groundedResearch({
      question: parsed.data.question,
      organizationId: auth.organizationId,
    });

    if (!result) {
      return NextResponse.json({ error: "Research unavailable" }, { status: 503 });
    }

    return NextResponse.json(result);
  } catch (err) {
    return httpErrorFromException(err, "Research failed");
  }
}
