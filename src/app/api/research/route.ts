import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth/context";
import { researchSchema } from "@/lib/validation/schemas";
import { groundedResearch } from "@/lib/providers/gemini";

export async function POST(request: Request) {
  try {
    const auth = await requireAuth();
    const body = await request.json();
    const parsed = researchSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
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
    const message = err instanceof Error ? err.message : "Research failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
