import { NextResponse } from "next/server";
import { httpStatusForAuthError, requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import {
  generateBusinessReviewDrafts,
  generateResponseDrafts,
  loadLatestReputationAudit,
} from "@/lib/reputation/engine";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, reviewIds } = body as { businessId?: string; reviewIds?: string[] };

    if (!businessId || !reviewIds?.length) {
      return NextResponse.json({ error: "businessId and reviewIds required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const supabase = createServiceClient();
    const { data: business } = await supabase.from("businesses").select("name").eq("id", businessId).single();
    const businessName = business?.name ?? "Business";

    // Prefer business_reviews (Reviews feed) when IDs match those rows.
    const { data: feedReviews } = await supabase
      .from("business_reviews")
      .select("id")
      .eq("business_id", businessId)
      .in("id", reviewIds);

    if (feedReviews?.length) {
      const drafts = await generateBusinessReviewDrafts({
        businessId,
        organizationId: auth.organizationId,
        reviewIds: feedReviews.map((r) => r.id as string),
        businessName,
      });
      return NextResponse.json({ drafts });
    }

    const latest = await loadLatestReputationAudit(businessId);
    if (!latest?.audit) {
      return NextResponse.json({ error: "No reputation audit found" }, { status: 400 });
    }

    const drafts = await generateResponseDrafts({
      auditId: latest.audit.id as string,
      businessId,
      organizationId: auth.organizationId,
      reviewRecordIds: reviewIds,
      businessName,
    });

    return NextResponse.json({ drafts });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to generate responses";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
