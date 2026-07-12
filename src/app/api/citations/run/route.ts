import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runCitationAudit } from "@/lib/citations/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, competitorLimit, vertical, forceRefresh } = body as {
      businessId?: string;
      competitorLimit?: number;
      vertical?: string;
      forceRefresh?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const result = await runCitationAudit({
      businessId,
      organizationId: auth.organizationId,
      competitorLimit,
      vertical,
      forceRefresh,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Citation audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
