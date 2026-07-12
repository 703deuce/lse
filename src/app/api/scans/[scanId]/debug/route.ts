import { NextResponse } from "next/server";
import { requireScanAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { buildBrightDataMapsGridRequest, mapsGridDepth } from "@/lib/providers/brightdata/maps-grid";
import { profileFromBatch } from "@/lib/maps/scan-profiles";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ scanId: string }> }
) {
  try {
    const { scanId } = await params;
    await requireScanAccess(scanId);
    const supabase = createServiceClient();

    const { data: batch } = await supabase.from("scan_batches").select("*").eq("id", scanId).single();
    if (!batch) return NextResponse.json({ error: "Scan not found" }, { status: 404 });

    const { data: business } = await supabase
      .from("businesses")
      .select("name, cid, place_id")
      .eq("id", batch.business_id)
      .single();

    const { data: keyword } = await supabase
      .from("business_keywords")
      .select("keyword")
      .eq("business_id", batch.business_id)
      .eq("is_primary", true)
      .maybeSingle();

    const { data: points } = await supabase
      .from("scan_points")
      .select("*")
      .eq("scan_batch_id", scanId)
      .order("grid_label");

    const pointIds = (points ?? []).map((p) => p.id);
    const { data: results } = pointIds.length
      ? await supabase.from("scan_results").select("*").in("scan_point_id", pointIds)
      : { data: [] };

    const resultByPoint = new Map((results ?? []).map((r) => [r.scan_point_id, r]));
    const profile = profileFromBatch(batch);
    const kw = (keyword?.keyword ?? "").trim();
    const depth = mapsGridDepth();

    const cells = (points ?? []).map((p) => {
      const result = resultByPoint.get(p.id);
      const storedRequest = result?.provider_request_json as Record<string, unknown> | null;
      const request =
        storedRequest ??
        buildBrightDataMapsGridRequest({
          keyword: kw,
          lat: p.lat as number,
          lng: p.lng as number,
          device: profile.device,
          os: profile.os,
          browser: profile.browser,
          depth,
        });

      const competitors = (result?.top_competitors_json ?? []) as Array<{ rank?: number; name?: string }>;

      return {
        gridLabel: p.grid_label,
        lat: p.lat,
        lng: p.lng,
        distanceFromCenterM: p.distance_from_center_m,
        hasResult: !!result,
        targetRank: result?.target_rank ?? null,
        targetFound: result?.target_found ?? false,
        matchReason: result?.confidence ?? null,
        competitorCount: competitors.length,
        topCompetitors: competitors.slice(0, 5).map((c) => ({ rank: c.rank, name: c.name })),
        request: {
          endpoint: (request as { endpoint?: string }).endpoint ?? "https://api.brightdata.com/request",
          provider: "brightdata",
          zone: (request as { zone?: string }).zone,
          url: (request as { url?: string }).url,
          query: (request as { query?: string }).query ?? kw,
          ll: (request as { ll?: string }).ll,
          gl: (request as { gl?: string }).gl ?? "us",
          hl: (request as { hl?: string }).hl ?? "en",
          depth: (request as { depth?: number }).depth ?? depth,
          device: (request as { device?: string }).device ?? profile.device,
          os: (request as { os?: string }).os ?? profile.os,
          browser: (request as { browser?: string }).browser ?? profile.browser,
          location_zoom:
            (request as { _meta?: { location_zoom?: number } })._meta?.location_zoom ?? 17,
        },
      };
    });

    return NextResponse.json({
      scanId,
      businessName: business?.name,
      keyword: kw,
      scanProfile: profile,
      provider: batch.provider ?? "brightdata",
      gridSize: batch.grid_size,
      radiusMeters: batch.radius_meters,
      status: batch.status,
      aggregateMetrics: batch.aggregate_metrics,
      cells,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Debug fetch failed";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
