import { createServiceClient } from "@/lib/db/client";
import type { MapsDifficultyResult } from "@/lib/maps-difficulty/enrich";
import type { ExpansionReachResult } from "@/lib/maps-difficulty/expansion-reach";

export interface MapsDifficultyRunResponse extends MapsDifficultyResult {
  expansionReach?: ExpansionReachResult;
  id?: string;
}

export interface MapsDifficultyHistoryRow {
  id: string;
  keyword: string;
  cityLabel: string | null;
  service: string | null;
  address: string | null;
  businessBaseAddress: string | null;
  searchLat: number | null;
  searchLng: number | null;
  mkdScore: number | null;
  difficultyLabel: string | null;
  expansionScore: number | null;
  expansionLabel: string | null;
  createdAt: string;
  result: MapsDifficultyRunResponse;
}

/** Persist a completed run. Best-effort: never throws into the request path. */
export async function saveRun(params: {
  organizationId: string | null;
  address: string | null;
  businessBaseAddress?: string | null;
  result: MapsDifficultyResult;
  expansionReach?: ExpansionReachResult;
}): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const { result, expansionReach } = params;
    const { data, error } = await supabase
      .from("maps_difficulty_runs")
      .insert({
        organization_id: params.organizationId,
        keyword: result.keyword,
        city_label: result.cityLabel,
        service: result.service,
        address: params.address,
        business_base_address: params.businessBaseAddress ?? expansionReach?.businessBaseInput ?? null,
        search_lat: result.searchPoint.lat,
        search_lng: result.searchPoint.lng,
        mkd_score: result.score.mapsKeywordDifficulty,
        difficulty_label: result.score.difficultyLabel,
        expansion_score: expansionReach?.expansionDifficultyScore ?? null,
        expansion_label: expansionReach?.expansionDifficultyLabel ?? null,
        score_json: result.score,
        businesses_json: result.businesses,
        expansion_json: expansionReach ?? null,
      })
      .select("id")
      .single();
    if (error) {
      console.error("[maps-difficulty] saveRun failed:", error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.error("[maps-difficulty] saveRun error:", err instanceof Error ? err.message : String(err));
    return null;
  }
}

/** Update an existing run with Expansion Reach (when recalculated without re-running KD). */
export async function updateRunExpansion(params: {
  runId: string;
  organizationId: string;
  businessBaseAddress: string;
  expansionReach: ExpansionReachResult;
}): Promise<boolean> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("maps_difficulty_runs")
      .update({
        business_base_address: params.businessBaseAddress,
        expansion_score: params.expansionReach.expansionDifficultyScore,
        expansion_label: params.expansionReach.expansionDifficultyLabel,
        expansion_json: params.expansionReach,
      })
      .eq("id", params.runId)
      .eq("organization_id", params.organizationId)
      .select("id")
      .maybeSingle();
    if (error) {
      console.error("[maps-difficulty] updateRunExpansion failed:", error.message);
      return false;
    }
    return Boolean(data?.id);
  } catch (err) {
    console.error("[maps-difficulty] updateRunExpansion error:", err instanceof Error ? err.message : String(err));
    return false;
  }
}

/** Recent runs for the org (most recent first), rehydrated into the result shape. */
export async function listRuns(organizationId: string | null, limit = 25): Promise<MapsDifficultyHistoryRow[]> {
  try {
    const supabase = createServiceClient();
    let query = supabase
      .from("maps_difficulty_runs")
      .select(
        "id, keyword, city_label, service, address, business_base_address, search_lat, search_lng, mkd_score, difficulty_label, expansion_score, expansion_label, created_at, score_json, businesses_json, expansion_json"
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    query = organizationId ? query.eq("organization_id", organizationId) : query.is("organization_id", null);

    const { data, error } = await query;
    if (error) {
      console.error("[maps-difficulty] listRuns failed:", error.message);
      return [];
    }
    return (data ?? []).map((r) => ({
      id: r.id as string,
      keyword: r.keyword as string,
      cityLabel: (r.city_label as string) ?? null,
      service: (r.service as string) ?? null,
      address: (r.address as string) ?? null,
      businessBaseAddress: (r.business_base_address as string) ?? null,
      searchLat: (r.search_lat as number) ?? null,
      searchLng: (r.search_lng as number) ?? null,
      mkdScore: (r.mkd_score as number) ?? null,
      difficultyLabel: (r.difficulty_label as string) ?? null,
      expansionScore: (r.expansion_score as number) ?? null,
      expansionLabel: (r.expansion_label as string) ?? null,
      createdAt: r.created_at as string,
      result: {
        keyword: r.keyword as string,
        cityLabel: (r.city_label as string) ?? "",
        service: (r.service as string) ?? "",
        searchPoint: { lat: (r.search_lat as number) ?? 0, lng: (r.search_lng as number) ?? 0 },
        generatedAt: r.created_at as string,
        score: r.score_json as MapsDifficultyResult["score"],
        businesses: (r.businesses_json as MapsDifficultyResult["businesses"]) ?? [],
        expansionReach: (r.expansion_json as ExpansionReachResult) ?? undefined,
        id: r.id as string,
      },
    }));
  } catch (err) {
    console.error("[maps-difficulty] listRuns error:", err instanceof Error ? err.message : String(err));
    return [];
  }
}
