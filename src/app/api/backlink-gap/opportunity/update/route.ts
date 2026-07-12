import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { updateOpportunityStatus } from "@/lib/backlink-gap/engine";

export async function PATCH(request: Request) {
  try {
    const body = await request.json();
    const { opportunityId, businessId, status } = body as {
      opportunityId?: string;
      businessId?: string;
      status?: "open" | "ignored" | "completed" | "spam";
    };

    if (!opportunityId || !businessId || !status) {
      return NextResponse.json({ error: "opportunityId, businessId, and status required" }, { status: 400 });
    }

    await requireBusinessAccess(businessId);
    await updateOpportunityStatus(opportunityId, status);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update opportunity";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
