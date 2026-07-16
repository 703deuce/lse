import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { updateReviewLinkSettings, type PosterConfig } from "@/lib/reputation/review-requests";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { businessId, shortSlug, posterConfig } = body as {
      businessId?: string;
      shortSlug?: string;
      posterConfig?: PosterConfig;
    };

    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }

    const auth = await requireBusinessAccess(businessId);
    const link = await updateReviewLinkSettings({
      businessId,
      organizationId: auth.organizationId,
      shortSlug,
      posterConfig,
    });

    return NextResponse.json({ link });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update review link";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
