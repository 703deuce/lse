import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runGrowthAudit } from "@/lib/growth-audit/engine";
import { PlanLimitError, releaseUsage, reserveUsageOrThrow } from "@/lib/plans";

export async function POST(request: Request) {
  let reserved = false;
  let organizationId: string | undefined;
  try {
    const body = await request.json();
    const { businessId, keyword, skipBackground } = body as {
      businessId?: string;
      keyword?: string;
      skipBackground?: boolean;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    organizationId = auth.organizationId;
    await reserveUsageOrThrow(auth.organizationId, "growth_audits_used", 1);
    reserved = true;
    const result = await runGrowthAudit({
      businessId,
      organizationId: auth.organizationId,
      keyword,
      skipBackground,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (reserved && organizationId) {
      await releaseUsage(organizationId, "growth_audits_used", 1).catch(() => {});
    }
    if (err instanceof PlanLimitError) {
      return NextResponse.json({ error: err.message, limitKey: err.limitKey }, { status: 402 });
    }
    const message = err instanceof Error ? err.message : "Growth audit failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
