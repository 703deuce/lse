import { NextResponse } from "next/server";
import { isDevPreviewBusiness } from "@/lib/auth/dev";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;

    if (isDevPreviewBusiness(businessId)) {
      const { REVIEWS_PREVIEW_DATA } = await import("@/lib/reviews/reviews-preview-data");
      return NextResponse.json({ ...REVIEWS_PREVIEW_DATA, businessId });
    }

    const { requireBusinessAccess } = await import("@/lib/auth/api-auth");
    const { loadReviewsPageData } = await import("@/lib/reviews/reviews-page-data");
    await requireBusinessAccess(businessId);
    const data = await loadReviewsPageData(businessId);
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load reviews";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
