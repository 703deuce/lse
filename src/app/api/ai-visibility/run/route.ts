import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runAiVisibilityCheck } from "@/lib/ai-visibility/engine";
import { assertWithinLimit, hasFeature, incrementUsage, PlanLimitError } from "@/lib/plans";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, maxPrompts, promptIds } = body as {
      businessId?: string;
      maxPrompts?: number;
      promptIds?: string[];
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    if (!(await hasFeature(auth.organizationId, "ai_visibility"))) {
      return NextResponse.json({ error: "AI Visibility is not included in your plan." }, { status: 403 });
    }
    await assertWithinLimit(auth.organizationId, "ai_visibility_runs_month", 1);
    const result = await runAiVisibilityCheck({
      businessId,
      organizationId: auth.organizationId,
      maxPrompts: maxPrompts ?? 1,
      promptIds,
    });

    await incrementUsage(auth.organizationId, "ai_visibility_runs_used", 1);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "AI visibility check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
