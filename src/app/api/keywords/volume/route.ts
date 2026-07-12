import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { refreshKeywordVolumes } from "@/lib/keyword-tracker/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, keywordIds } = body as { businessId?: string; keywordIds?: string[] };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const result = await refreshKeywordVolumes({
      businessId,
      organizationId: auth.organizationId,
      keywordIds,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Volume refresh failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
