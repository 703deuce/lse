import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runBacklinkGap } from "@/lib/backlink-gap/engine";
import { assertWithinLimit, incrementUsage, PlanLimitError } from "@/lib/plans";

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
    await assertWithinLimit(auth.organizationId, "backlink_gap_runs_month", 1);
    const result = await runBacklinkGap({
      businessId,
      organizationId: auth.organizationId,
      scanBatchId,
      competitorLimit,
      selectedCompetitorIds,
      forceRefresh,
    });

    await incrementUsage(auth.organizationId, "backlink_gap_runs_used", 1);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Backlink gap analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
