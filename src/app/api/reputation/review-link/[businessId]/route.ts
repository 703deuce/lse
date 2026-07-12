import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadReviewRequestKit } from "@/lib/reputation/review-requests";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    const auth = await requireBusinessAccess(businessId);
    const data = await loadReviewRequestKit(businessId, auth.organizationId);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load review request kit";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
