import { subDays, startOfDay } from "date-fns";
import type { createServiceClient } from "@/lib/db/client";
import { dedupeKey, hasOwnerResponse, type NormalizedReview } from "@/lib/reviews/normalize";
import { extractThemeTagsFromText } from "@/lib/reviews/review-themes";

type Supabase = ReturnType<typeof createServiceClient>;

/** Columns needed for list/UI metrics — excludes bulky raw_json. */
export const REVIEW_LIST_COLUMNS =
  "id, organization_id, business_id, competitor_id, source_provider, source_review_id, reviewer_name, rating, review_text, review_date, relative_date_text, owner_response_text, review_url, created_at, updated_at";

export type StoredReviewRow = {
  id: string;
  organization_id: string;
  business_id: string | null;
  competitor_id: string | null;
  source_provider: string;
  source_review_id: string | null;
  reviewer_name: string | null;
  rating: number | null;
  review_text: string | null;
  review_date: string | null;
  relative_date_text: string | null;
  owner_response_text: string | null;
  review_url: string | null;
  raw_json?: Record<string, unknown>;
  created_at: string;
  updated_at?: string;
};

export function storedRowToNormalized(row: StoredReviewRow): NormalizedReview {
  return {
    sourceReviewId: row.source_review_id,
    reviewerName: row.reviewer_name,
    rating: row.rating != null ? Number(row.rating) : null,
    reviewText: row.review_text,
    reviewDate: row.review_date ? startOfDay(new Date(row.review_date)) : null,
    relativeDateText: row.relative_date_text,
    ownerResponseText: row.owner_response_text,
    reviewUrl: row.review_url,
    raw: row.raw_json ?? {},
  };
}

export async function loadKnownReviewIds(
  supabase: Supabase,
  params: { businessId?: string | null; competitorId?: string | null }
): Promise<Set<string>> {
  const ids = new Set<string>();
  let query = supabase.from("business_reviews").select("source_review_id").not("source_review_id", "is", null);
  if (params.businessId) query = query.eq("business_id", params.businessId);
  else if (params.competitorId) query = query.eq("competitor_id", params.competitorId);
  else return ids;

  const { data } = await query.limit(5000);
  for (const row of data ?? []) {
    if (row.source_review_id) ids.add(row.source_review_id);
  }
  return ids;
}

/**
 * Batch upsert on migration 027 unique indexes:
 * - (business_id, source_provider, source_review_id)
 * - (competitor_id, source_provider, source_review_id)
 */
export async function upsertReviews(
  supabase: Supabase,
  params: {
    organizationId: string;
    businessId?: string | null;
    competitorId?: string | null;
    provider: string;
    reviews: NormalizedReview[];
    entityKey: string;
  }
): Promise<{ inserted: number; updated: number }> {
  const entityId = params.businessId ?? params.competitorId;
  if (!entityId || !params.reviews.length) {
    return { inserted: 0, updated: 0 };
  }

  const now = new Date().toISOString();
  const bySourceId = new Map<
    string,
    {
      organization_id: string;
      business_id: string | null;
      competitor_id: string | null;
      source_provider: string;
      source_review_id: string;
      reviewer_name: string | null;
      rating: number | null;
      review_text: string | null;
      review_date: string | null;
      relative_date_text: string | null;
      owner_response_text: string | null;
      review_url: string | null;
      raw_json: Record<string, unknown>;
      updated_at: string;
    }
  >();

  for (const review of params.reviews) {
    const sourceReviewId = review.sourceReviewId ?? dedupeKey(review, params.entityKey).slice(0, 120);
    bySourceId.set(sourceReviewId, {
      organization_id: params.organizationId,
      business_id: params.businessId ?? null,
      competitor_id: params.competitorId ?? null,
      source_provider: params.provider,
      source_review_id: sourceReviewId,
      reviewer_name: review.reviewerName,
      rating: review.rating,
      review_text: review.reviewText,
      review_date: review.reviewDate ? review.reviewDate.toISOString().slice(0, 10) : null,
      relative_date_text: review.relativeDateText,
      owner_response_text: review.ownerResponseText,
      review_url: review.reviewUrl,
      raw_json: review.raw,
      updated_at: now,
    });
  }

  const rows = Array.from(bySourceId.values());
  const sourceIds = rows.map((r) => r.source_review_id);

  let existingQuery = supabase
    .from("business_reviews")
    .select("source_review_id")
    .eq("source_provider", params.provider)
    .in("source_review_id", sourceIds);

  if (params.businessId) existingQuery = existingQuery.eq("business_id", params.businessId);
  else existingQuery = existingQuery.eq("competitor_id", params.competitorId!);

  const { data: existingRows } = await existingQuery;
  const existingSet = new Set(
    (existingRows ?? []).map((r) => r.source_review_id).filter((id): id is string => Boolean(id))
  );

  const onConflict = params.businessId
    ? "business_id,source_provider,source_review_id"
    : "competitor_id,source_provider,source_review_id";

  // Chunk to keep payloads bounded on large syncs.
  const chunkSize = 200;
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    const { error } = await supabase.from("business_reviews").upsert(chunk, {
      onConflict,
      ignoreDuplicates: false,
    });
    if (error) throw new Error(error.message);
  }

  const updated = rows.filter((r) => existingSet.has(r.source_review_id)).length;
  const inserted = rows.length - updated;

  const knownIds = sourceIds.filter(Boolean).slice(0, 500);

  await updateSyncState(supabase, {
    organizationId: params.organizationId,
    businessId: params.businessId,
    competitorId: params.competitorId,
    knownReviewIds: knownIds,
    lastSyncAt: now,
    lastReviewDateSeen: params.reviews.find((r) => r.reviewDate)?.reviewDate?.toISOString().slice(0, 10) ?? null,
  });

  return { inserted, updated };
}

async function updateSyncState(
  supabase: Supabase,
  params: {
    organizationId: string;
    businessId?: string | null;
    competitorId?: string | null;
    knownReviewIds: string[];
    lastSyncAt: string;
    lastReviewDateSeen: string | null;
  }
) {
  const entityId = params.businessId ?? params.competitorId;
  if (!entityId) return;

  const conflictCol = params.businessId ? "business_id" : "competitor_id";

  let existingQuery = supabase.from("review_sync_state").select("known_review_ids");
  if (params.businessId) existingQuery = existingQuery.eq("business_id", params.businessId);
  else existingQuery = existingQuery.eq("competitor_id", params.competitorId!);

  const { data: existing } = await existingQuery.maybeSingle();

  const mergedIds = Array.from(
    new Set([...(existing?.known_review_ids as string[] | undefined ?? []), ...params.knownReviewIds])
  ).slice(-500);

  const row = {
    organization_id: params.organizationId,
    business_id: params.businessId ?? null,
    competitor_id: params.competitorId ?? null,
    last_sync_at: params.lastSyncAt,
    last_review_date_seen: params.lastReviewDateSeen,
    known_review_ids: mergedIds,
    updated_at: params.lastSyncAt,
  };

  const { error } = await supabase.from("review_sync_state").upsert(row, {
    onConflict: conflictCol,
    ignoreDuplicates: false,
  });
  if (error) throw new Error(error.message);
}

export async function loadStoredReviews(
  supabase: Supabase,
  params: {
    businessId?: string | null;
    competitorId?: string | null;
    competitorIds?: string[];
    lookbackDays?: number;
    limit?: number;
    /** When true, also select raw_json (default: omit for lean list payloads). */
    includeRaw?: boolean;
  }
): Promise<StoredReviewRow[]> {
  const lookbackDays = params.lookbackDays ?? 90;
  const cutoff = subDays(new Date(), lookbackDays).toISOString().slice(0, 10);

  let query = params.includeRaw
    ? supabase
        .from("business_reviews")
        .select(
          "id, organization_id, business_id, competitor_id, source_provider, source_review_id, reviewer_name, rating, review_text, review_date, relative_date_text, owner_response_text, review_url, created_at, updated_at, raw_json"
        )
        .gte("review_date", cutoff)
        .order("review_date", { ascending: false })
    : supabase
        .from("business_reviews")
        .select(REVIEW_LIST_COLUMNS)
        .gte("review_date", cutoff)
        .order("review_date", { ascending: false });

  if (params.businessId) {
    query = query.eq("business_id", params.businessId);
  } else if (params.competitorId) {
    query = query.eq("competitor_id", params.competitorId);
  } else if (params.competitorIds?.length) {
    query = query.in("competitor_id", params.competitorIds);
  } else {
    return [];
  }

  if (params.limit) query = query.limit(params.limit);
  const { data } = await query;
  return (data ?? []) as unknown as StoredReviewRow[];
}

export function reviewsInWindow(rows: StoredReviewRow[], days: number): StoredReviewRow[] {
  const cutoff = subDays(new Date(), days);
  return rows.filter((r) => {
    if (!r.review_date) return false;
    return startOfDay(new Date(r.review_date)) >= startOfDay(cutoff);
  });
}

export function calcResponseRate(rows: StoredReviewRow[]): number {
  if (!rows.length) return 0;
  const replied = rows.filter((r) => hasOwnerResponse(r.owner_response_text)).length;
  return Math.round((replied / rows.length) * 100);
}

export function calcAvgRating(rows: StoredReviewRow[]): number | null {
  const rated = rows.filter((r) => r.rating != null);
  if (!rated.length) return null;
  const sum = rated.reduce((acc, r) => acc + Number(r.rating), 0);
  return Math.round((sum / rated.length) * 10) / 10;
}

export function extractTagsFromText(text: string | null, limit = 3): string[] {
  return extractThemeTagsFromText(text, limit);
}
