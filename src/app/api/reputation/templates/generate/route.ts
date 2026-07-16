import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { EntitlementError, requireEntitlement } from "@/lib/auth/entitlements";
import {
  generateAndSaveTemplates,
  loadReviewRequestKit,
} from "@/lib/reputation/review-requests";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { businessId, tone } = body as { businessId?: string; tone?: string };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    await requireEntitlement(auth.organizationId, "review_campaigns");
    const kit = await loadReviewRequestKit(businessId, auth.organizationId);

    if (!kit.link?.review_url) {
      return NextResponse.json(
        { error: kit.warning ?? "Create a review link first" },
        { status: 400 }
      );
    }

    const result = await generateAndSaveTemplates({
      businessId,
      organizationId: auth.organizationId,
      businessName: kit.businessName,
      reviewUrl: kit.link.review_url,
      keywordSuggestions: kit.keywordSuggestions.map((k) => String(k.keyword)),
      tone,
    });

    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof EntitlementError) {
      return NextResponse.json({ error: err.message, entitlement: err.entitlement }, { status: 403 });
    }
    const message = err instanceof Error ? err.message : "Failed to generate templates";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
