import { analyzeScreenshot } from "@/lib/providers/kimi";
import { requireAuth } from "@/lib/auth/context";
import { visionAnalyzeSchema } from "@/lib/validation/schemas";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    const parsed = visionAnalyzeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
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
    const message = err instanceof Error ? err.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
