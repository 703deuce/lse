import { subDays, startOfDay } from "date-fns";
import type { createServiceClient } from "@/lib/db/client";
import { dedupeKey, hasOwnerResponse, type NormalizedReview } from "@/lib/reviews/normalize";

type Supabase = ReturnType<typeof createServiceClient>;

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
  raw_json: Record<string, unknown>;
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
  let inserted = 0;
  let updated = 0;
  const now = new Date().toISOString();

  for (const review of params.reviews) {
    const sourceReviewId = review.sourceReviewId ?? dedupeKey(review, params.entityKey).slice(0, 120);
    const row = {
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
    };

    const conflictCol = params.businessId ? "business_id" : "competitor_id";
    const entityId = params.businessId ?? params.competitorId;
    if (!entityId) continue;

    const { data: existing } = await supabase
      .from("business_reviews")
      .select("id")
      .eq(conflictCol, entityId)
      .eq("source_provider", params.provider)
      .eq("source_review_id", sourceReviewId)
      .maybeSingle();

    if (existing) {
      await supabase.from("business_reviews").update(row).eq("id", existing.id);
      updated++;
    } else {
      const { error } = await supabase.from("business_reviews").insert(row);
      if (!error) inserted++;
    }
  }

  const knownIds = params.reviews
    .map((r) => r.sourceReviewId ?? dedupeKey(r, params.entityKey).slice(0, 120))
    .filter(Boolean)
    .slice(0, 500);

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
  const row = {
    organization_id: params.organizationId,
    business_id: params.businessId ?? null,
    competitor_id: params.competitorId ?? null,
    last_sync_at: params.lastSyncAt,
    last_review_date_seen: params.lastReviewDateSeen,
    known_review_ids: params.knownReviewIds,
    updated_at: params.lastSyncAt,
  };

  const conflictCol = params.businessId ? "business_id" : "competitor_id";
  const entityId = params.businessId ?? params.competitorId;
  if (!entityId) return;

  const { data: existing } = await supabase
    .from("review_sync_state")
    .select("id, known_review_ids")
    .eq(conflictCol, entityId)
    .maybeSingle();

  const mergedIds = Array.from(
    new Set([...(existing?.known_review_ids as string[] | undefined ?? []), ...params.knownReviewIds])
  ).slice(-500);

  if (existing) {
    await supabase
      .from("review_sync_state")
      .update({ ...row, known_review_ids: mergedIds })
      .eq("id", existing.id);
  } else {
    await supabase.from("review_sync_state").insert({ ...row, known_review_ids: mergedIds });
  }
}

export async function loadStoredReviews(
  supabase: Supabase,
  params: {
    businessId?: string | null;
    competitorId?: string | null;
    lookbackDays?: number;
    limit?: number;
  }
): Promise<StoredReviewRow[]> {
  const lookbackDays = params.lookbackDays ?? 90;
  const cutoff = subDays(new Date(), lookbackDays).toISOString().slice(0, 10);

  let query = supabase
    .from("business_reviews")
    .select("*")
    .gte("review_date", cutoff)
    .order("review_date", { ascending: false });

  if (params.businessId) query = query.eq("business_id", params.businessId);
  else if (params.competitorId) query = query.eq("competitor_id", params.competitorId);
  else return [];

  if (params.limit) query = query.limit(params.limit);
  const { data } = await query;
  return (data ?? []) as StoredReviewRow[];
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

import { extractThemeTagsFromText } from "@/lib/reviews/review-themes";

export function extractTagsFromText(text: string | null, limit = 3): string[] {
  return extractThemeTagsFromText(text, limit);
}
