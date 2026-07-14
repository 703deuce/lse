import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runBacklinkGap } from "@/lib/backlink-gap/engine";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";

export async function POST(request: Request) {
  let reserved = false;
  let organizationId: string | undefined;
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
    organizationId = auth.organizationId;
    await reserveUsageOrThrow(auth.organizationId, "backlink_gap_runs_used", 1);
    reserved = true;
    const result = await runBacklinkGap({
      businessId,
      organizationId: auth.organizationId,
      scanBatchId,
      competitorLimit,
      selectedCompetitorIds,
      forceRefresh,
    });

    // Cache hits must not consume a billed run.
    if (result.fromCache) {
      await releaseUsage(auth.organizationId, "backlink_gap_runs_used", 1).catch(() => {});
      reserved = false;
    }

    return NextResponse.json(result);
  } catch (err) {
    if (reserved && organizationId) {
      await releaseUsage(organizationId, "backlink_gap_runs_used", 1).catch(() => {});
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Backlink gap analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
