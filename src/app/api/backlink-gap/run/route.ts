import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runBacklinkGap } from "@/lib/backlink-gap/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, scanBatchId, competitorLimit, selectedCompetitorIds, forceRefresh } = body as {
      businessId?: string;
      scanBatchId?: string;
      competitorLimit?: number;
      selectedCompetitorIds?: string[];
      forceRefresh?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const result = await runBacklinkGap({
      businessId,
      organizationId: auth.organizationId,
      scanBatchId,
      competitorLimit,
      selectedCompetitorIds,
      forceRefresh,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Backlink gap analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
