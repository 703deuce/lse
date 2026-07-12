import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { runReviewMomentum } from "@/lib/reviews/momentum-engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, scanBatchId, competitorLimit, lookbackDays } = body as {
      businessId?: string;
      scanBatchId?: string;
      competitorLimit?: number;
      lookbackDays?: number;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const result = await runReviewMomentum({
      businessId,
      organizationId: auth.organizationId,
      scanBatchId,
      competitorLimit,
      lookbackDays,
    });

    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Review momentum run failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
