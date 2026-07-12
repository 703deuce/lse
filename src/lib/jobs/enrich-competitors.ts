import { myBusinessInfo, type BusinessInfoItem } from "@/lib/providers/dataforseo";
import {
  placeDetails,
  placePhotos,
  placePosts,
} from "@/lib/providers/scrapingdog";
import { fetchReviewsForEntity } from "@/lib/reviews/fetch-reviews";
import { createServiceClient } from "@/lib/db/client";
import type { AggregatedCompetitor } from "@/lib/maps/grid";
import { normalizePlaceTopics } from "@/lib/audit/json-fields";

export interface EnrichedProfile {
  name: string;
  category?: string | null;
  additional_categories?: string[];
  rating?: number;
  review_count?: number;
  photo_count?: number;
  post_count?: number;
  is_claimed?: boolean;
  description?: string;
  place_topics?: unknown[];
  justifications?: unknown[];
  recent_review_count?: number;
}

function isGooglePlaceId(id: string): boolean {
  return id.startsWith("ChIJ") || id.startsWith("GhIJ");
}

function findBusinessInfoMatch(
  items: BusinessInfoItem[],
  params: { name: string; cid?: string | null; placeId?: string | null }
): BusinessInfoItem | undefined {
  return items.find(
    (i) =>
      (params.placeId && i.place_id === params.placeId) ||
      (params.cid && i.cid === params.cid) ||
      i.title?.toLowerCase().includes(params.name.toLowerCase())
  );
}

function applyBusinessInfoMatch(
  profile: EnrichedProfile,
  match: BusinessInfoItem,
  fallbackName: string
): EnrichedProfile {
  const topics = normalizePlaceTopics(match.place_topics);
  return {
    ...profile,
    name: match.title ?? fallbackName,
    category: match.category ?? profile.category,
    additional_categories: match.additional_categories ?? profile.additional_categories ?? [],
    rating: match.rating?.value ?? profile.rating,
    review_count: match.rating?.votes_count ?? profile.review_count,
    is_claimed: match.is_claimed ?? profile.is_claimed,
    description: match.description ?? profile.description,
    place_topics: topics.length ? topics : profile.place_topics,
  };
}

async function enrichFromScrapingDog(
  profile: EnrichedProfile,
  params: {
    placeId: string;
    cid?: string | null;
    name: string;
    city?: string | null;
    state?: string | null;
    lat?: number | null;
    lng?: number | null;
    organizationId?: string;
  }
): Promise<EnrichedProfile> {
  const result = { ...profile };
  const { placeId, organizationId } = params;

  try {
    const details = await placeDetails({ placeId, organizationId });
    result.category = (details.category as string) ?? (details.type as string) ?? result.category;
    result.rating = Number(details.rating ?? details.rating_value ?? result.rating ?? 0);
    result.review_count = Number(details.reviews ?? details.review_count ?? result.review_count ?? 0);
    result.description = (details.description as string | undefined) ?? result.description;
  } catch {
    /* optional */
  }

  try {
    const photos = await placePhotos({ placeId, organizationId });
    result.photo_count = photos.length;
  } catch {
    /* optional */
  }

  try {
    const posts = await placePosts({ placeId, organizationId });
    result.post_count = posts.length;
  } catch {
    /* optional */
  }

  const fetchResult = await fetchReviewsForEntity({
    placeId,
    cid: params.cid,
    name: params.name,
    city: params.city,
    state: params.state,
    lat: params.lat,
    lng: params.lng,
    organizationId,
    mapsTotalReviews: result.review_count ?? null,
    mapsRating: result.rating ?? null,
  });

  if (fetchResult.velocityAvailable) {
    const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
    result.recent_review_count = fetchResult.reviews.filter(
      (r) => r.reviewDate && r.reviewDate.getTime() >= thirtyDaysAgo
    ).length;
  }

  return result;
}

const ENRICHMENT_CACHE_DAYS = 7;

function snapshotToProfile(
  snap: {
    category?: string | null;
    additional_categories?: unknown;
    rating?: number | null;
    review_count?: number | null;
    photo_count?: number | null;
    post_count?: number | null;
    place_topics_json?: unknown;
    attributes_json?: unknown;
  },
  fallbackName: string
): EnrichedProfile {
  const attrs = (snap.attributes_json ?? {}) as Record<string, unknown>;
  return {
    name: fallbackName,
    category: snap.category,
    additional_categories: Array.isArray(snap.additional_categories)
      ? (snap.additional_categories as string[])
      : [],
    rating: snap.rating ?? undefined,
    review_count: snap.review_count ?? undefined,
    photo_count: snap.photo_count ?? undefined,
    post_count: snap.post_count ?? undefined,
    place_topics: Array.isArray(snap.place_topics_json) ? snap.place_topics_json : [],
    recent_review_count:
      typeof attrs.recent_review_count === "number" ? attrs.recent_review_count : undefined,
  };
}

async function loadCachedEnrichment(params: {
  cid?: string | null;
  placeId?: string | null;
  name: string;
}): Promise<EnrichedProfile | null> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - ENRICHMENT_CACHE_DAYS * 24 * 60 * 60 * 1000).toISOString();

  let competitorId: string | null = null;
  if (params.cid) {
    const { data } = await supabase.from("competitors").select("id").eq("cid", params.cid).maybeSingle();
    competitorId = data?.id ?? null;
  }
  if (!competitorId && params.placeId) {
    const { data } = await supabase
      .from("competitors")
      .select("id")
      .eq("place_id", params.placeId)
      .maybeSingle();
    competitorId = data?.id ?? null;
  }
  if (!competitorId) return null;

  const { data: snap } = await supabase
    .from("competitor_snapshots")
    .select("*")
    .eq("competitor_id", competitorId)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!snap) return null;
  return snapshotToProfile(snap, params.name);
}

export async function enrichCompetitor(params: {
  name: string;
  cid?: string | null;
  placeId?: string | null;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
  organizationId?: string;
  seedRating?: number;
  seedReviewCount?: number;
}): Promise<EnrichedProfile> {
  const cached = await loadCachedEnrichment(params);
  if (cached) return cached;

  let profile: EnrichedProfile = {
    name: params.name,
    rating: params.seedRating ?? 0,
    review_count: params.seedReviewCount ?? 0,
    photo_count: 0,
    post_count: 0,
  };

  if (params.cid || params.placeId) {
    try {
      const info = await myBusinessInfo({
        keyword: params.name,
        city: params.city ?? undefined,
        state: params.state ?? undefined,
        lat: params.lat,
        lng: params.lng,
        cid: params.cid,
        placeId: params.placeId,
        organizationId: params.organizationId,
      });
      const match = findBusinessInfoMatch(info, params);
      if (match) {
        profile = applyBusinessInfoMatch(profile, match, params.name);
      }
    } catch {
      /* use seed / scrapingdog data */
    }
  }

  const scrapingPlaceId =
    params.placeId && isGooglePlaceId(params.placeId) ? params.placeId : null;
  if (scrapingPlaceId) {
    profile = await enrichFromScrapingDog(profile, {
      placeId: scrapingPlaceId,
      cid: params.cid,
      name: params.name,
      city: params.city,
      state: params.state,
      lat: params.lat,
      lng: params.lng,
      organizationId: params.organizationId,
    });
  } else if (params.cid || params.placeId) {
    const fetchResult = await fetchReviewsForEntity({
      placeId: params.placeId,
      cid: params.cid,
      name: params.name,
      city: params.city,
      state: params.state,
      lat: params.lat,
      lng: params.lng,
      organizationId: params.organizationId,
      mapsTotalReviews: profile.review_count ?? params.seedReviewCount ?? null,
      mapsRating: profile.rating ?? params.seedRating ?? null,
    });
    if (fetchResult.velocityAvailable) {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      profile.recent_review_count = fetchResult.reviews.filter(
        (r) => r.reviewDate && r.reviewDate.getTime() >= thirtyDaysAgo
      ).length;
    }
  }

  return profile;
}

export async function enrichTargetBusiness(params: {
  name: string;
  cid?: string | null;
  placeId?: string | null;
  city?: string | null;
  state?: string | null;
  lat?: number | null;
  lng?: number | null;
  organizationId?: string;
}): Promise<EnrichedProfile> {
  return enrichCompetitor(params);
}

export async function saveCompetitorSnapshots(params: {
  scanBatchId: string;
  competitors: AggregatedCompetitor[];
  lat?: number | null;
  lng?: number | null;
  city?: string | null;
  state?: string | null;
  organizationId?: string;
}): Promise<EnrichedProfile[]> {
  const supabase = createServiceClient();
  const enriched: EnrichedProfile[] = [];

  for (const comp of params.competitors.slice(0, 5)) {
    if (!comp.name && !comp.cid) continue;

    const data = await enrichCompetitor({
      name: comp.name ?? "Unknown",
      cid: comp.cid,
      placeId: comp.place_id,
      lat: params.lat,
      lng: params.lng,
      city: params.city,
      state: params.state,
      seedRating: comp.rating,
      seedReviewCount: comp.review_count,
      organizationId: params.organizationId,
    });
    enriched.push(data);

    let competitorId: string | undefined;
    const { data: existing } = await supabase
      .from("competitors")
      .select("id")
      .eq("cid", comp.cid ?? "")
      .maybeSingle();

    if (existing) {
      competitorId = existing.id;
    } else {
      const { data: created } = await supabase
        .from("competitors")
        .insert({ cid: comp.cid ?? null, name: comp.name ?? "Unknown" })
        .select("id")
        .single();
      competitorId = created?.id;
    }

    if (!competitorId) continue;

    await supabase.from("competitor_snapshots").insert({
      scan_batch_id: params.scanBatchId,
      competitor_id: competitorId,
      category: data.category ?? null,
      additional_categories: data.additional_categories ?? [],
      rating: data.rating ?? null,
      review_count: data.review_count ?? null,
      photo_count: data.photo_count ?? null,
      post_count: data.post_count ?? null,
      place_topics_json: normalizePlaceTopics(data.place_topics),
      justifications_json: data.justifications ?? [],
      attributes_json: { recent_review_count: data.recent_review_count ?? 0 },
    });
  }

  return enriched;
}
