import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { loadDashboardRecentScans } from "@/lib/overview/load-dashboard-scans";

/**
 * Lightweight poll endpoint for the overview recent-scans card.
 * Used while scans are in progress so the spinner → heatmap swap happens
 * without a full page reload.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);
    const url = new URL(request.url);
    const preview = Math.min(
      10,
      Math.max(1, Number(url.searchParams.get("preview") ?? 3) || 3)
    );
    const data = await loadDashboardRecentScans(businessId, { preview, limit: 40 });
    return NextResponse.json(data, {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load recent scans");
  }
}
