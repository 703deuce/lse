import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
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

    const auth = await requireBusinessAccess(businessId);
    await updateOpportunityStatus(opportunityId, status, businessId, auth.organizationId);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update opportunity";
    const statusCode =
      message.includes("access denied") || message.includes("not found") ? 403 : 500;
    return NextResponse.json({ error: message }, { status: statusCode });
  }
}
