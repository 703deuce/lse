import { NextResponse } from "next/server";
import { httpStatusForAuthError, requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadAiVisibilityData } from "@/lib/ai-visibility/engine";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);
    const { searchParams } = new URL(request.url);
    const runId = searchParams.get("runId");
    const includeArchived = searchParams.get("includeArchived") === "1";

    const data = await loadAiVisibilityData(businessId, runId, { includeArchived });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load AI visibility data";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
