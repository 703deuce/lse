import { NextResponse } from "next/server";
import { httpErrorFromException } from "@/lib/security/http-errors";
import { z } from "zod";
import { requireBusinessAccess } from "@/lib/auth/api-auth";
import { createServiceClient } from "@/lib/db/client";
import { fetchMapsResults } from "@/lib/keyword-tracker/rank-check";
import { extractTopCompetitors } from "@/lib/providers/dataforseo";
import { matchTargetInResults } from "@/lib/providers/dataforseo/match-target";
import { rankBucketFromRank, visibilityFromRank } from "@/lib/keyword-tracker/visibility";

const schema = z.object({
  businessId: z.string().uuid(),
  keyword: z.string().min(1),
  keywordId: z.string().uuid().optional(),
  lat: z.number(),
  lng: z.number(),
  label: z.string().optional(),
  locationId: z.string().uuid().optional().nullable(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }

    const auth = await requireBusinessAccess(parsed.data.businessId);
    const supabase = createServiceClient();

    const { data: business } = await supabase
      .from("businesses")
      .select("name, cid, place_id, phone, website_url")
      .eq("id", parsed.data.businessId)
      .single();

    if (!business) {
      return NextResponse.json({ error: "Business not found" }, { status: 404 });
    }

    const keyword = parsed.data.keyword.trim();
    const { items, provider } = await fetchMapsResults({
      keyword,
      lat: parsed.data.lat,
      lng: parsed.data.lng,
      organizationId: auth.organizationId,
    });

    const match = matchTargetInResults(
      items,
      {
        name: business.name,
        cid: business.cid,
        place_id: business.place_id,
        phone: business.phone,
        website_url: business.website_url,
      },
      items.length
    );

    const rawResults = extractTopCompetitors(items);
    const rank = match.found ? match.rank : null;
    const matchedResult = match.item
      ? rawResults.find(
          (r) =>
            (r.cid && r.cid === match.item?.cid) ||
            (r.place_id && r.place_id === match.item?.place_id) ||
            r.name === match.item?.title
        ) ?? { name: match.item.title, rank: match.rank ?? undefined, cid: match.item.cid, place_id: match.item.place_id }
      : null;

    const { data: row, error } = await supabase
      .from("single_point_rank_checks")
      .insert({
        organization_id: auth.organizationId,
        business_id: parsed.data.businessId,
        location_id: parsed.data.locationId ?? null,
        keyword,
        keyword_id: parsed.data.keywordId ?? null,
        lat: parsed.data.lat,
        lng: parsed.data.lng,
        label: parsed.data.label?.trim() || null,
        rank,
        rank_bucket: rankBucketFromRank(rank),
        visibility_score: visibilityFromRank(rank),
        result_count: items.length,
        raw_results: rawResults,
        matched_result: matchedResult,
        match_reason: match.matchReason,
        checked_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !row) {
      return NextResponse.json({ error: error?.message ?? "Save failed" }, { status: 500 });
    }

    return NextResponse.json({
      check: row,
      rank,
      result_count: items.length,
      raw_results: rawResults,
      matched_result: matchedResult,
      match_reason: match.matchReason,
      provider,
    });
  } catch (err) {
    return httpErrorFromException(err, "Rank check failed");
  }
}
