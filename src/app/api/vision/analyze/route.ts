import { analyzeScreenshot } from "@/lib/providers/kimi";
import { requireAuth } from "@/lib/auth/context";
import { visionAnalyzeSchema } from "@/lib/validation/schemas";
import { NextResponse } from "next/server";
import { assertRateLimit } from "@/lib/security/rate-limit";
import { httpErrorFromException } from "@/lib/security/http-errors";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const rate = await assertRateLimit({
      key: `vision:${auth.organizationId}`,
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
    const parsed = visionAnalyzeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    const result = await analyzeScreenshot({
      imageBase64: parsed.data.imageBase64,
      prompt: parsed.data.prompt,
      organizationId: auth.organizationId,
    });

    if (!result) {
      return NextResponse.json({ error: "Vision analysis unavailable" }, { status: 503 });
    }

    return NextResponse.json({ analysis: result });
  } catch (err) {
    return httpErrorFromException(err, "Analysis failed");
  }
}
