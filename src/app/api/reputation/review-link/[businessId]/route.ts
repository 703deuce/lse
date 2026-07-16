import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { isDevPreviewBusiness } from "@/lib/auth/dev";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    if (isDevPreviewBusiness(businessId)) {
      return NextResponse.json({
        businessName: "Bright Smile Dental",
        businessId,
      });
    }

    const { loadReviewRequestKit } = await import("@/lib/reputation/review-requests");
    const auth = await requireBusinessAccess(businessId);
    const data = await loadReviewRequestKit(businessId, auth.organizationId);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load review request kit";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
