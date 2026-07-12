import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { addManualPrompt } from "@/lib/ai-visibility/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, promptText, activate } = body as {
      businessId?: string;
      promptText?: string;
      activate?: boolean;
    };

    if (!businessId || !promptText?.trim()) {
      return NextResponse.json({ error: "businessId and promptText required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const data = await addManualPrompt({
      businessId,
      organizationId: auth.organizationId,
      promptText: promptText.trim(),
      activate: activate ?? false,
    });

    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to add prompt";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
