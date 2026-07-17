import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
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
    return httpErrorFromException(err, "Failed to load citations");
  }
}
