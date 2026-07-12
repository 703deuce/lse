import { NextResponse } from "next/server";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { loadGbpProfile, loadCompetitorsForBusiness } from "@/lib/audit/run-audit";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ businessId: string }> }
) {
  try {
    const { businessId } = await params;
    await requireBusinessAccess(businessId);

    const db = createServiceClient();
    const { data: biz } = await db.from("businesses").select("*").eq("id", businessId).single();
    if (!biz) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const { data: keywords } = await db.from("business_keywords").select("*").eq("business_id", businessId);
    const primaryKw = keywords?.find((k) => k.is_primary) ?? keywords?.[0];

    const gbp = await loadGbpProfile(businessId);
    const competitors = await loadCompetitorsForBusiness(businessId);

    const { data: latestScan } = await db
      .from("scan_batches")
      .select("id, status, aggregate_metrics, grid_size, radius_meters")
      .eq("business_id", businessId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const listings = [
      {
        id: "target",
        name: biz.name,
        isTarget: true,
        rating: gbp?.rating,
        reviewCount: gbp?.reviewCount,
        category: gbp?.primaryCategory,
        address: gbp?.address,
        phone: gbp?.phone,
        website: gbp?.website,
        lat: biz.lat,
        lng: biz.lng,
      },
      ...competitors.map((c, i) => ({
        id: `comp-${i}`,
        name: c.name,
        isTarget: false,
        rank: c.rank ?? i + 1,
        rating: c.rating,
        reviewCount: c.reviewCount,
        category: c.category,
        website: c.website,
      })),
    ];

    return NextResponse.json({
      business: biz,
      keyword: primaryKw?.keyword ?? "",
      city: primaryKw?.city ?? "",
      state: primaryKw?.state ?? "",
      gbp,
      listings,
      competitors,
      latestScan,
      center: [biz.scan_center_lat ?? biz.lat ?? 38.65, biz.scan_center_lng ?? biz.lng ?? -77.28],
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to load workspace";
    return NextResponse.json({ error: message }, { status: 403 });
  }
}
