import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runAiVisibilityCheck } from "@/lib/ai-visibility/engine";

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
    const result = await runAiVisibilityCheck({
      businessId,
      organizationId: auth.organizationId,
      maxPrompts: maxPrompts ?? 1,
      promptIds,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "AI visibility check failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
