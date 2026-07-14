import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { archivePrompt } from "@/lib/ai-visibility/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, promptId } = body as { businessId?: string; promptId?: string };

    if (!businessId || !promptId) {
      return NextResponse.json({ error: "businessId and promptId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const data = await archivePrompt({
      businessId,
      organizationId: auth.organizationId,
      promptId,
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to archive prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
