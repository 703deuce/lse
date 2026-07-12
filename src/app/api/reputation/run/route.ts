import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runReputationAudit } from "@/lib/reputation/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, competitorLimit, lookbackDays, forceRefresh } = body as {
      businessId?: string;
      competitorLimit?: number;
      lookbackDays?: number;
      forceRefresh?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const result = await runReputationAudit({
      businessId,
      organizationId: auth.organizationId,
      competitorLimit,
      lookbackDays,
      forceRefresh,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Reputation audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
