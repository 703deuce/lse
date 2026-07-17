import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { suggestKeywords } from "@/lib/keyword-tracker/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId } = body as { businessId?: string };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const result = await suggestKeywords({
      businessId,
      organizationId: auth.organizationId,
    });

    return NextResponse.json(result);
  } catch (err) {
    return httpErrorFromException(err, "Suggestion failed");
  }
}
