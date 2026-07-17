import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";

/** List completed scans available for report generation. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const businessId = url.searchParams.get("businessId");
    if (!businessId) {
      return NextResponse.json({ error: "businessId required" }, { status: 400 });
    }
    await requireBusinessAccess(businessId);
    const supabase = createServiceClient();

    const { data: batches, error } = await supabase
      .from("scan_batches")
      .select(
        "id, grid_size, radius_meters, created_at, finished_at, location_id, center_label, aggregate_metrics, confidence_summary, status"
      )
      .eq("business_id", businessId)
      .in("status", ["ready", "partial", "rank_ready"])
      .order("created_at", { ascending: false })
      .limit(40);

    if (error) throw new Error(error.message);

    const scans = (batches ?? []).map((b) => {
      const conf = (b.confidence_summary ?? {}) as {
        keyword_label?: string;
        keyword_ids?: string[];
      };
      const metrics = (b.aggregate_metrics ?? {}) as {
        averageRank?: number | null;
        visibilityScore?: number | null;
        top3Cells?: number | null;
        totalCells?: number | null;
      };
      return {
        id: b.id as string,
        keyword: conf.keyword_label ?? "Keyword scan",
        keywordId: conf.keyword_ids?.[0] ?? null,
        locationId: (b.location_id as string | null) ?? null,
        centerLabel: (b.center_label as string | null) ?? null,
        gridSize: b.grid_size as number,
        radiusMeters: b.radius_meters as number,
        scannedAt: (b.finished_at as string | null) ?? (b.created_at as string),
        averageRank: metrics.averageRank ?? null,
        visibilityScore: metrics.visibilityScore ?? null,
        top3Cells: metrics.top3Cells ?? null,
        totalCells: metrics.totalCells ?? null,
        status: b.status as string,
      };
    });

    return NextResponse.json({ scans });
  } catch (err) {
    return httpErrorFromException(err, "Failed to load scans");
  }
}
