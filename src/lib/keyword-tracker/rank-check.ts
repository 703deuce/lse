import { mapsGridCell } from "@/lib/providers/brightdata/maps-grid";
import { mapsLiveGridCell, type MapsLiveResult } from "@/lib/providers/dataforseo";
import { matchTargetInResults, type TargetMatchInput } from "@/lib/providers/dataforseo/match-target";
import { LOCAL_FALCON_PARITY } from "@/lib/maps/local-falcon-parity";
import { mapsDepth } from "@/lib/jobs/run-grid-cells";
import { rankBucketFromRank, visibilityFromRank } from "@/lib/keyword-tracker/visibility";

export type CenterRankCheckResult = {
  rank: number | null;
  rank_bucket: ReturnType<typeof rankBucketFromRank>;
  visibility_score: number;
  result_count: number;
  matched_by: string | null;
  raw_json: Record<string, unknown>;
};

export async function fetchMapsResults(params: {
  keyword: string;
  lat: number;
  lng: number;
  organizationId?: string;
}): Promise<{ items: MapsLiveResult[]; provider: string }> {
  const depth = mapsDepth();
  try {
    const live = await mapsGridCell({
      keyword: params.keyword,
      lat: params.lat,
      lng: params.lng,
      device: "desktop",
      os: "windows",
      browser: "chrome",
      depth,
      organizationId: params.organizationId,
    });
    return { items: live.items, provider: "maps" };
  } catch {
    const live = await mapsLiveGridCell({
      keyword: params.keyword,
      lat: params.lat,
      lng: params.lng,
      depth,
      zoom: LOCAL_FALCON_PARITY.locationZoom,
      organizationId: params.organizationId,
    });
    return { items: live.items, provider: "maps_fallback" };
  }
}

export async function checkCenterRank(params: {
  keyword: string;
  lat: number;
  lng: number;
  business: TargetMatchInput;
  organizationId?: string;
}): Promise<CenterRankCheckResult> {
  const { items, provider } = await fetchMapsResults({
    keyword: params.keyword,
    lat: params.lat,
    lng: params.lng,
    organizationId: params.organizationId,
  });

  const match = matchTargetInResults(items, params.business, items.length);
  const rank = match.found ? match.rank : null;

  return {
    rank,
    rank_bucket: rankBucketFromRank(rank),
    visibility_score: visibilityFromRank(rank),
    result_count: items.length,
    matched_by: match.matchReason,
    raw_json: {
      provider,
      found: match.found,
      match_reason: match.matchReason,
      top_titles: items.slice(0, 5).map((i) => i.title),
    },
  };
}
