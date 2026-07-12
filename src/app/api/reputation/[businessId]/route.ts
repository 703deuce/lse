import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadLatestReputationAudit } from "@/lib/reputation/engine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);
    const data = await loadLatestReputationAudit(businessId);
    if (!data) {
      return NextResponse.json({
        audit: null,
        reviews: [],
        targetReviews: [],
        competitors: [],
        keywordGaps: [],
        tasks: [],
      });
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load reputation audit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
