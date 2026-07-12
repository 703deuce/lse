import pLimit from "p-limit";
import { createServiceClient } from "@/lib/db/client";
import { getBusiness } from "@/lib/db/queries";
import { parseUsAddressCityState } from "@/lib/geo/us-address";
import {
  fetchKeywordVolumes,
  resolveCityStateMarket,
  parseCityStateLabel,
  formatGoogleAdsLocationLabel,
  formatMarketDisplay,
  MarketResolutionError,
  type GoogleAdsMarket,
} from "@/lib/providers/dataforseo/keywords-volume";
import {
  fallbackKeywordSuggestions,
  generateKeywordSuggestions,
  type KeywordSuggestionAi,
} from "@/lib/providers/deepseek/keywords";
import { checkCenterRank } from "@/lib/keyword-tracker/rank-check";
import { opportunityScore } from "@/lib/keyword-tracker/visibility";

const CHECK_CONCURRENCY = 3;

export type TrackedKeywordRow = {
  id: string;
  keyword: string;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  search_volume: number | null;
  search_volume_source: string | null;
  google_ads_location_code: number | null;
  tracking_frequency: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type RankCheckRow = {
  id: string;
  tracked_keyword_id: string;
  keyword: string;
  rank: number | null;
  rank_bucket: string;
  visibility_score: number;
  result_count: number;
  matched_by: string | null;
  checked_at: string;
};

export type KeywordWithChecks = TrackedKeywordRow & {
  latest_check: RankCheckRow | null;
  previous_check: RankCheckRow | null;
  rank_change: number | null;
  opportunity: number;
  recent_checks: RankCheckRow[];
};

export type KeywordTrackerSummary = {
  tracked_count: number;
  avg_rank: number | null;
  top3_count: number;
  best_opportunity: { keyword: string; score: number; keyword_id?: string } | null;
  avg_rank_delta: number | null;
  top3_delta: number | null;
};

async function loadBusinessCoords(businessId: string, organizationId: string) {
  const business = await getBusiness(businessId, organizationId);
  if (!business) throw new Error("Business not found");
  const lat = business.scan_center_lat ?? business.lat;
  const lng = business.scan_center_lng ?? business.lng;
  if (lat == null || lng == null) throw new Error("Business location is required for rank checks");
  return {
    business,
    lat: Number(lat),
    lng: Number(lng),
    target: {
      cid: business.cid,
      place_id: business.place_id,
      name: business.name,
      address: business.address_text,
      phone: business.phone,
      website_url: business.website_url,
    },
  };
}

export type VolumeMarket = {
  city: string | null;
  state: string | null;
  label: string;
  display: string;
  location_code: number | null;
  level: "city" | "state" | "country" | "missing";
  ready: boolean;
};

async function loadBusinessCityState(businessId: string) {
  const supabase = createServiceClient();
  const [{ data: keywords }, { data: business }] = await Promise.all([
    supabase.from("business_keywords").select("city, state, is_primary").eq("business_id", businessId),
    supabase.from("businesses").select("address_text").eq("id", businessId).single(),
  ]);
  const primary = keywords?.find((k) => k.is_primary) ?? keywords?.[0];
  const fromAddress = parseUsAddressCityState(business?.address_text);
  const city = primary?.city?.trim() || fromAddress.city;
  const state = primary?.state?.trim() || fromAddress.state;
  return { city, state, ready: Boolean(city && state) };
}

async function resolveVolumeMarket(params: {
  businessId: string;
  organizationId?: string;
  overrideLabel?: string | null;
}): Promise<{ city: string; state: string; market: GoogleAdsMarket }> {
  if (params.overrideLabel?.trim()) {
    const { city, state } = parseCityStateLabel(params.overrideLabel);
    const market = await resolveCityStateMarket({
      city,
      state,
      organizationId: params.organizationId,
      strict: true,
    });
    return { city, state, market };
  }

  const business = await loadBusinessCityState(params.businessId);

  if (!business.ready || !business.city || !business.state) {
    throw new MarketResolutionError(
      "Could not determine city and state from this business profile. Check the GMB address on file."
    );
  }

  const market = await resolveCityStateMarket({
    city: business.city,
    state: business.state,
    organizationId: params.organizationId,
    strict: true,
  });

  return { city: business.city, state: business.state, market };
}

async function loadVolumeMarketInfo(businessId: string, organizationId?: string): Promise<VolumeMarket> {
  const business = await loadBusinessCityState(businessId);
  if (!business.ready || !business.city || !business.state) {
    return {
      city: business.city,
      state: business.state,
      label: "",
      display: "",
      location_code: null,
      level: "missing",
      ready: false,
    };
  }

  try {
    const market = await resolveCityStateMarket({
      city: business.city,
      state: business.state,
      organizationId,
      strict: true,
    });
    return {
      city: business.city,
      state: business.state,
      label: market.location_name,
      display: formatMarketDisplay(market),
      location_code: market.location_code,
      level: market.level,
      ready: market.level === "city",
    };
  } catch {
    return {
      city: business.city,
      state: business.state,
      label: "",
      display: `${business.city}, ${business.state}`,
      location_code: null,
      level: "missing",
      ready: false,
    };
  }
}

function buildSummary(rows: KeywordWithChecks[]): KeywordTrackerSummary {
  const active = rows.filter((r) => r.active);
  const ranks = active.map((r) => r.latest_check?.rank).filter((r): r is number => r != null && r > 0);
  const avg_rank = ranks.length ? Math.round((ranks.reduce((a, b) => a + b, 0) / ranks.length) * 10) / 10 : null;
  const top3_count = active.filter((r) => (r.latest_check?.rank ?? 99) <= 3).length;
  const best = [...active].sort((a, b) => b.opportunity - a.opportunity)[0];

  const prevRanks = active
    .map((r) => r.previous_check?.rank)
    .filter((r): r is number => r != null && r > 0);
  const avg_prev = prevRanks.length
    ? Math.round((prevRanks.reduce((a, b) => a + b, 0) / prevRanks.length) * 10) / 10
    : null;
  const avg_rank_delta =
    avg_rank != null && avg_prev != null ? Math.round((avg_prev - avg_rank) * 10) / 10 : null;
  const prevTop3 = active.filter((r) => (r.previous_check?.rank ?? 99) <= 3).length;
  const top3_delta = prevRanks.length ? top3_count - prevTop3 : null;

  return {
    tracked_count: active.length,
    avg_rank,
    top3_count,
    best_opportunity: best
      ? { keyword: best.keyword, score: best.opportunity, keyword_id: best.id }
      : null,
    avg_rank_delta,
    top3_delta,
  };
}

export async function loadKeywordTrackerData(businessId: string): Promise<{
  keywords: KeywordWithChecks[];
  suggestions: Array<Record<string, unknown>>;
  summary: KeywordTrackerSummary;
  market: VolumeMarket;
  business: { name: string; lat: number | null; lng: number | null };
}> {
  const supabase = createServiceClient();

  const [{ data: keywords, error: kwErr }, { data: business, error: bizErr }, market] = await Promise.all([
    supabase
      .from("tracked_keywords")
      .select("*")
      .eq("business_id", businessId)
      .order("created_at", { ascending: true }),
    supabase.from("businesses").select("name, lat, lng, scan_center_lat, scan_center_lng").eq("id", businessId).single(),
    loadVolumeMarketInfo(businessId),
  ]);

  if (kwErr) throw new Error(kwErr.message);
  if (bizErr) throw new Error(bizErr.message);

  const ids = (keywords ?? []).map((k) => k.id);
  let checks: RankCheckRow[] = [];
  if (ids.length) {
    const { data } = await supabase
      .from("keyword_rank_checks")
      .select("id, tracked_keyword_id, keyword, rank, rank_bucket, visibility_score, result_count, matched_by, checked_at")
      .in("tracked_keyword_id", ids)
      .order("checked_at", { ascending: false });
    checks = (data ?? []) as RankCheckRow[];
  }

  const checksByKeyword = new Map<string, RankCheckRow[]>();
  for (const c of checks) {
    const list = checksByKeyword.get(c.tracked_keyword_id) ?? [];
    list.push(c);
    checksByKeyword.set(c.tracked_keyword_id, list);
  }

  const enriched: KeywordWithChecks[] = (keywords ?? []).map((k) => {
    const history = checksByKeyword.get(k.id) ?? [];
    const latest = history[0] ?? null;
    const previous = history[1] ?? null;
    const rank_change =
      latest?.rank != null && previous?.rank != null ? previous.rank - latest.rank : null;
    return {
      ...(k as TrackedKeywordRow),
      latest_check: latest,
      previous_check: previous,
      rank_change,
      opportunity: opportunityScore(latest?.rank ?? null, k.search_volume),
      recent_checks: history.slice(0, 12),
    };
  });

  const { data: suggestions } = await supabase
    .from("keyword_suggestions")
    .select("*")
    .eq("business_id", businessId)
    .eq("status", "suggested")
    .order("created_at", { ascending: false })
    .limit(50);

  return {
    keywords: enriched,
    suggestions: suggestions ?? [],
    summary: buildSummary(enriched),
    market,
    business: {
      name: business?.name ?? "",
      lat: business?.scan_center_lat ?? business?.lat ?? null,
      lng: business?.scan_center_lng ?? business?.lng ?? null,
    },
  };
}

export async function loadKeywordTrackerOverview(businessId: string): Promise<KeywordTrackerSummary | null> {
  const data = await loadKeywordTrackerData(businessId);
  if (!data.keywords.length) return null;
  return data.summary;
}

export async function addTrackedKeyword(params: {
  businessId: string;
  organizationId: string;
  keyword: string;
  locationName?: string | null;
  lat?: number | null;
  lng?: number | null;
  trackingFrequency?: "daily" | "weekly";
  fetchVolume?: boolean;
  suggestionId?: string;
}) {
  const supabase = createServiceClient();
  const coords = await loadBusinessCoords(params.businessId, params.organizationId);
  const keyword = params.keyword.trim();
  if (!keyword) throw new Error("Keyword is required");

  const { market } = await resolveVolumeMarket({
    businessId: params.businessId,
    organizationId: params.organizationId,
    overrideLabel: params.locationName,
  });

  let search_volume: number | null = null;
  let search_volume_source: string | null = null;

  if (params.fetchVolume !== false) {
    try {
      const volumes = await fetchKeywordVolumes({
        keywords: [keyword],
        location: market,
        organizationId: params.organizationId,
      });
      search_volume = volumes[0]?.search_volume ?? null;
      search_volume_source = "google_ads";
    } catch {
      search_volume = null;
      search_volume_source = null;
    }
  }

  const { data, error } = await supabase
    .from("tracked_keywords")
    .upsert(
      {
        organization_id: params.organizationId,
        business_id: params.businessId,
        keyword,
        location_name: formatGoogleAdsLocationLabel(market),
        google_ads_location_code: market.location_code,
        lat: params.lat ?? coords.lat,
        lng: params.lng ?? coords.lng,
        search_volume,
        search_volume_source,
        tracking_frequency: params.trackingFrequency ?? "weekly",
        active: true,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "business_id,keyword" }
    )
    .select("*")
    .single();

  if (error) throw new Error(error.message);

  if (params.suggestionId) {
    await supabase
      .from("keyword_suggestions")
      .update({ status: "added" })
      .eq("id", params.suggestionId)
      .eq("business_id", params.businessId);
  }

  return data;
}

export async function runKeywordChecks(params: {
  businessId: string;
  organizationId: string;
  keywordIds?: string[];
}) {
  const supabase = createServiceClient();
  const { lat, lng, target } = await loadBusinessCoords(params.businessId, params.organizationId);

  let query = supabase.from("tracked_keywords").select("*").eq("business_id", params.businessId).eq("active", true);
  if (params.keywordIds?.length) query = query.in("id", params.keywordIds);

  const { data: keywords, error } = await query;
  if (error) throw new Error(error.message);
  if (!keywords?.length) throw new Error("No active keywords to check");

  const limit = pLimit(CHECK_CONCURRENCY);
  const results = await Promise.all(
    keywords.map((kw) =>
      limit(async () => {
        const checkLat = kw.lat ?? lat;
        const checkLng = kw.lng ?? lng;
        const result = await checkCenterRank({
          keyword: kw.keyword,
          lat: checkLat,
          lng: checkLng,
          business: target,
          organizationId: params.organizationId,
        });

        const { data: saved, error: saveErr } = await supabase
          .from("keyword_rank_checks")
          .insert({
            organization_id: params.organizationId,
            business_id: params.businessId,
            tracked_keyword_id: kw.id,
            keyword: kw.keyword,
            lat: checkLat,
            lng: checkLng,
            rank: result.rank,
            rank_bucket: result.rank_bucket,
            visibility_score: result.visibility_score,
            result_count: result.result_count,
            matched_by: result.matched_by,
            raw_json: result.raw_json,
          })
          .select("*")
          .single();

        if (saveErr) throw new Error(saveErr.message);
        return saved;
      })
    )
  );

  return { checked: results.length, checks: results };
}

export async function refreshKeywordVolumes(params: { businessId: string; organizationId: string; keywordIds?: string[] }) {
  const supabase = createServiceClient();
  const { market: businessMarket } = await resolveVolumeMarket({
    businessId: params.businessId,
    organizationId: params.organizationId,
  });

  let query = supabase
    .from("tracked_keywords")
    .select("id, keyword, google_ads_location_code")
    .eq("business_id", params.businessId)
    .eq("active", true);
  if (params.keywordIds?.length) query = query.in("id", params.keywordIds);

  const { data: keywords, error } = await query;
  if (error) throw new Error(error.message);
  if (!keywords?.length) return { updated: 0 };

  const volumes = await fetchKeywordVolumes({
    keywords: keywords.map((k) => k.keyword),
    location: businessMarket,
    organizationId: params.organizationId,
  });

  const volumeMap = new Map(volumes.map((v) => [v.keyword.toLowerCase(), v.search_volume]));

  let updated = 0;
  for (const kw of keywords) {
    const vol = volumeMap.get(kw.keyword.toLowerCase()) ?? null;
    const { error: upErr } = await supabase
      .from("tracked_keywords")
      .update({
        search_volume: vol,
        search_volume_source: "google_ads",
        location_name: formatGoogleAdsLocationLabel(businessMarket),
        google_ads_location_code: businessMarket.location_code,
        updated_at: new Date().toISOString(),
      })
      .eq("id", kw.id);
    if (!upErr) updated++;
  }

  return { updated };
}

function flattenSuggestions(output: {
  groups: Record<string, KeywordSuggestionAi[]>;
}): KeywordSuggestionAi[] {
  const all: KeywordSuggestionAi[] = [];
  for (const list of Object.values(output.groups)) {
    all.push(...list);
  }
  return all;
}

export async function suggestKeywords(params: { businessId: string; organizationId: string }) {
  const supabase = createServiceClient();
  const { business, lat, lng } = await loadBusinessCoords(params.businessId, params.organizationId);
  const geo = await resolveVolumeMarket({
    businessId: params.businessId,
    organizationId: params.organizationId,
  });

  const { data: existing } = await supabase.from("tracked_keywords").select("keyword").eq("business_id", params.businessId);
  const tracked = new Set((existing ?? []).map((k) => k.keyword.toLowerCase()));

  const { data: bizKw } = await supabase.from("business_keywords").select("*").eq("business_id", params.businessId);
  const primaryKw = bizKw?.find((k) => k.is_primary) ?? bizKw?.[0];

  const payload = {
    business_name: business.name,
    category: business.primary_category,
    city: primaryKw?.city,
    primary_keyword: primaryKw?.keyword,
    address: business.address_text,
    existing_keywords: [...tracked],
  };

  let ai =
    (await generateKeywordSuggestions({ payload, organizationId: params.organizationId })) ??
    fallbackKeywordSuggestions({
      category: business.primary_category,
      city: primaryKw?.city,
      primaryKeyword: primaryKw?.keyword,
    });

  const flat = flattenSuggestions(ai).filter((s) => !tracked.has(s.keyword.toLowerCase()));
  const unique = new Map<string, KeywordSuggestionAi>();
  for (const s of flat) unique.set(s.keyword.toLowerCase(), s);
  const candidates = [...unique.values()].slice(0, 25);

  let volumes: Array<{ keyword: string; search_volume: number | null }> = [];
  if (candidates.length) {
    try {
      volumes = await fetchKeywordVolumes({
        keywords: candidates.map((c) => c.keyword),
        location: geo.market,
        organizationId: params.organizationId,
      });
    } catch {
      volumes = [];
    }
  }
  const volMap = new Map(volumes.map((v) => [v.keyword.toLowerCase(), v.search_volume]));

  await supabase.from("keyword_suggestions").delete().eq("business_id", params.businessId).eq("status", "suggested");

  const rows = candidates.map((s) => ({
    organization_id: params.organizationId,
    business_id: params.businessId,
    keyword: s.keyword,
    search_volume: volMap.get(s.keyword.toLowerCase()) ?? s.estimated_volume ?? null,
    intent_type: s.intent_type,
    priority: s.priority,
    reason: s.reason,
    status: "suggested",
  }));

  if (rows.length) {
    const { error } = await supabase.from("keyword_suggestions").insert(rows);
    if (error) throw new Error(error.message);
  }

  return { summary: ai.summary, suggestions: rows, groups: ai.groups, default_lat: lat, default_lng: lng };
}

export async function dismissSuggestion(suggestionId: string, businessId: string) {
  const supabase = createServiceClient();
  await supabase
    .from("keyword_suggestions")
    .update({ status: "dismissed" })
    .eq("id", suggestionId)
    .eq("business_id", businessId);
}

export async function deactivateKeyword(keywordId: string, businessId: string) {
  const supabase = createServiceClient();
  await supabase.from("tracked_keywords").update({ active: false, updated_at: new Date().toISOString() }).eq("id", keywordId).eq("business_id", businessId);
}
