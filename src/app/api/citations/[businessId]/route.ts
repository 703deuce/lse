import { NextResponse } from "next/server";
import { requireBusinessAccess, httpStatusForAuthError } from "@/lib/auth/api-auth";
import { loadLatestCitationAudit } from "@/lib/citations/engine";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);
    const data = await loadLatestCitationAudit(businessId);
    if (!data) {
      return NextResponse.json({ audit: null, listings: [], missing: [], tasks: [], napIssues: [], competitorPresence: [] });
    }
    return NextResponse.json(data);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load citations";
    return NextResponse.json({ error: message }, { status: httpStatusForAuthError(err) });
  }
}
