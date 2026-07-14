import { PageHeader } from "@/components/ui/page-header";
import { requireAuth } from "@/lib/auth/context";
import { getBusiness, getLatestScan } from "@/lib/db/queries";
import { createServiceClient } from "@/lib/db/client";
import { aggregateCompetitors } from "@/lib/maps/grid";
import { enrichTargetBusiness } from "@/lib/jobs/enrich-competitors";
import { CompetitorComparison } from "@/components/audit/competitor-comparison";
import { notFound } from "next/navigation";

function normName(name: string | null | undefined): string {
  return (name ?? "").trim().toLowerCase().replace(/\s+/g, " ");
}

export default async function CompetitorsPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  const { businessId } = await params;
  const auth = await requireAuth();
  const business = await getBusiness(businessId, auth.organizationId);
  if (!business) notFound();

  const latestScan = await getLatestScan(businessId);
  const supabase = createServiceClient();
  const { data: primaryKw } = await supabase
    .from("business_keywords")
    .select("city, state, keyword")
    .eq("business_id", businessId)
    .eq("is_primary", true)
    .maybeSingle();

  let competitors: Array<{ name?: string; cid?: string; place_id?: string; appearances: number; avgRank: number }> = [];
  if (latestScan) {
    const { data: points } = await supabase.from("scan_points").select("id").eq("scan_batch_id", latestScan.id);
    const pointIds = (points ?? []).map((p) => p.id);
    if (pointIds.length) {
      const { data: results } = await supabase.from("scan_results").select("top_competitors_json").in("scan_point_id", pointIds);
      competitors = aggregateCompetitors(results ?? [], {
        excludeCid: business.cid,
        excludePlaceId: business.place_id,
        excludeName: business.name,
        targetCategory: business.primary_category,
        keyword: primaryKw?.keyword,
        sortBy: "top3Appearances",
      }).slice(0, 5);
    }
  }

  const targetProfile = await enrichTargetBusiness({
    name: business.name,
    cid: business.cid,
    placeId: business.place_id,
    city: primaryKw?.city,
    state: primaryKw?.state,
    lat: business.scan_center_lat ?? business.lat,
    lng: business.scan_center_lng ?? business.lng,
    organizationId: auth.organizationId,
  });

  const { data: snapshots } = latestScan
    ? await supabase
        .from("competitor_snapshots")
        .select("*, competitors(name, cid, place_id)")
        .eq("scan_batch_id", latestScan.id)
    : { data: [] };

  type SnapRow = {
    category?: string | null;
    rating?: number | null;
    review_count?: number | null;
    photo_count?: number | null;
    post_count?: number | null;
    attributes_json?: { recent_review_count?: number } | null;
    competitors?: { name?: string | null; cid?: string | null; place_id?: string | null } | null;
  };

  const snapList = (snapshots ?? []) as SnapRow[];

  function findSnapshot(c: { name?: string; cid?: string; place_id?: string }): SnapRow | undefined {
    if (c.cid) {
      const byCid = snapList.find((s) => s.competitors?.cid && s.competitors.cid === c.cid);
      if (byCid) return byCid;
    }
    if (c.place_id) {
      const byPlace = snapList.find((s) => s.competitors?.place_id && s.competitors.place_id === c.place_id);
      if (byPlace) return byPlace;
    }
    const n = normName(c.name);
    if (!n) return undefined;
    return snapList.find((s) => normName(s.competitors?.name) === n);
  }

  const comparisonProfiles = [
    {
      name: targetProfile.name,
      isTarget: true,
      category: targetProfile.category,
      additional_categories: targetProfile.additional_categories,
      rating: targetProfile.rating,
      review_count: targetProfile.review_count,
      photo_count: targetProfile.photo_count,
      post_count: targetProfile.post_count,
      is_claimed: targetProfile.is_claimed,
      recent_review_count: targetProfile.recent_review_count,
    },
    ...competitors.map((c) => {
      const snap = findSnapshot(c);
      return {
        name: c.name ?? "Unknown",
        category: snap?.category,
        rating: snap?.rating,
        review_count: snap?.review_count,
        photo_count: snap?.photo_count,
        post_count: snap?.post_count,
        recent_review_count: snap?.attributes_json?.recent_review_count,
      };
    }),
  ];

  return (
    <>
      <PageHeader title="Competitor audit" subtitle="Side-by-side public profile comparison" />

        {!latestScan ? (
          <p className="text-zinc-500">Run a scan first to compare competitors.</p>
        ) : (
          <CompetitorComparison profiles={comparisonProfiles} />
        )}
    </>
  );
}
