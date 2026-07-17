import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { activatePrompt } from "@/lib/ai-visibility/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, promptId } = body as { businessId?: string; promptId?: string };

    if (!businessId || !promptId) {
      return NextResponse.json({ error: "businessId and promptId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const data = await activatePrompt({
      businessId,
      organizationId: auth.organizationId,
      promptId,
    });

    return NextResponse.json(data);
  } catch (err) {
    return httpErrorFromException(err, "Failed to activate prompt");
  }
}
