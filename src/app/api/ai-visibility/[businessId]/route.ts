import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadAiVisibilityData, ensurePrimaryPrompt } from "@/lib/ai-visibility/engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const auth = await requireBusinessAccess(businessId);
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");

    let data = await loadAiVisibilityData(businessId, runId);

    if (!data.primaryPrompt) {
      data = await ensurePrimaryPrompt({
        businessId,
        organizationId: auth.organizationId,
      });
      if (runId) {
        data = await loadAiVisibilityData(businessId, runId);
      }
    }

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load AI visibility data";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
