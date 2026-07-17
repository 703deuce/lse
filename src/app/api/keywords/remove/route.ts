import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { deactivateKeyword } from "@/lib/keyword-tracker/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, keywordId } = body as { businessId?: string; keywordId?: string };

    if (!businessId || !keywordId) {
      return NextResponse.json({ error: "businessId and keywordId required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    await deactivateKeyword(keywordId, businessId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return httpErrorFromException(err, "Failed to remove keyword");
  }
}
