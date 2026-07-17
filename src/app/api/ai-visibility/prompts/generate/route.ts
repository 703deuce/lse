import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { ensurePrimaryPrompt } from "@/lib/ai-visibility/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, regenerate } = body as { businessId?: string; regenerate?: boolean };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const data = await ensurePrimaryPrompt({
      businessId,
      organizationId: auth.organizationId,
      regenerate: regenerate ?? false,
    });

    const primaryPrompt = data.primaryPrompt?.prompt_text ?? null;
    const suggestedPrompts = data.suggestedPrompts.map((p) => ({
      id: p.id,
      prompt: p.prompt_text,
      reason: p.reason,
      category: p.category,
      intent_type: p.intent_type,
      estimated_priority:
        (p.opportunity_score ?? 0) >= 5 ? "High" : (p.opportunity_score ?? 0) >= 3 ? "Medium" : "Low",
      opportunity_score: p.opportunity_score,
    }));

    return NextResponse.json({
      primaryPrompt,
      suggestedPrompts,
      promptCount: 1,
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to generate prompts");
  }
}
