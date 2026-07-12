import type { GbpProfile } from "@/lib/audit/types";
import { placePhotos, placePosts } from "@/lib/providers/scrapingdog";
import { fetchReviewsForEntity } from "@/lib/reviews/fetch-reviews";
import { createServiceClient } from "@/lib/db/client";

export interface ReviewAuditResult {
  rating: number;
  reviewCount: number;
  recentReviewCount: number;
  keywords: string[];
  missingThemes: string[];
  recommendations: string[];
  sampleReviews: Array<{ text: string; rating?: number; date?: string }>;
  velocityAvailable: boolean;
  velocityWarning: string | null;
  warnings: string[];
}

export interface PostAuditResult {
  postCount: number;
  recentPosts: Array<{ title?: string; snippet?: string; date?: string }>;
  recommendedTopics: string[];
}

export interface PhotoAuditResult {
  photoCount: number;
  competitorAvg?: number;
  recommendations: string[];
}

const SERVICE_KEYWORDS = [
  "fast",
  "professional",
  "friendly",
  "price",
  "affordable",
  "on time",
  "clean",
  "recommend",
  "same day",
  "responsive",
];

async function getBusinessIdentifiers(businessId: string): Promise<{
  placeId: string | null;
  cid: string | null;
  name: string;
}> {
  const db = createServiceClient();
  const { data } = await db.from("businesses").select("place_id, cid, name").eq("id", businessId).single();
  return {
    placeId: data?.place_id ?? null,
    cid: data?.cid ?? null,
    name: data?.name ?? "Business",
  };
}

function extractKeywords(reviews: Array<{ reviewText?: string | null }>): string[] {
  const freq = new Map<string, number>();
  for (const r of reviews) {
    const text = String(r.reviewText ?? "").toLowerCase();
    for (const kw of SERVICE_KEYWORDS) {
      if (text.includes(kw)) freq.set(kw, (freq.get(kw) ?? 0) + 1);
    }
  }
  return [...freq.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);
}

export async function runReviewAudit(gbp: GbpProfile, businessId: string): Promise<ReviewAuditResult> {
  const { placeId, cid, name } = await getBusinessIdentifiers(businessId);

  const fetchResult = await fetchReviewsForEntity({
    placeId,
    cid,
    name,
    mapsTotalReviews: gbp.reviewCount ?? null,
    mapsRating: gbp.rating ?? null,
  });

  const reviews = fetchResult.reviews;
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentReviewCount = reviews.filter(
    (r) => r.reviewDate && r.reviewDate.getTime() >= thirtyDaysAgo
  ).length;

  const keywords = extractKeywords(reviews);
  const missingThemes = SERVICE_KEYWORDS.filter((k) => !keywords.includes(k)).slice(0, 5);
  const recommendations: string[] = [];

  if (!fetchResult.velocityAvailable) {
    recommendations.push(
      fetchResult.velocityWarning ??
        "Dated review history unavailable — velocity metrics could not be calculated."
    );
  } else if (recentReviewCount < 2) {
    recommendations.push("Increase review velocity — aim for 2+ new reviews per month with post-job follow-up.");
  }
  if (missingThemes.length >= 3) {
    recommendations.push(`Encourage reviews mentioning: ${missingThemes.slice(0, 3).join(", ")}`);
  }
  if ((gbp.reviewCount ?? 0) < 50) {
    recommendations.push("Review volume under 50 — prominence gap vs established competitors.");
  }

  const sampleReviews = reviews.slice(0, 5).map((r) => ({
    text: r.reviewText ?? "",
    rating: r.rating ?? undefined,
    date: r.reviewDate?.toISOString().slice(0, 10) ?? r.relativeDateText ?? undefined,
  }));

  return {
    rating: gbp.rating ?? 0,
    reviewCount: gbp.reviewCount ?? reviews.length,
    recentReviewCount,
    keywords,
    missingThemes,
    recommendations: recommendations.length
      ? recommendations
      : ["Review profile looks healthy — maintain monthly review requests."],
    sampleReviews,
    velocityAvailable: fetchResult.velocityAvailable,
    velocityWarning: fetchResult.velocityWarning,
    warnings: fetchResult.warnings,
  };
}

export async function runPostAudit(gbp: GbpProfile, businessId: string): Promise<PostAuditResult> {
  const { placeId } = await getBusinessIdentifiers(businessId);
  let posts: unknown[] = [];
  if (placeId) {
    try {
      posts = await placePosts({ placeId });
    } catch {
      /* optional */
    }
  }

  const recentPosts = posts.slice(0, 5).map((p) => {
    const post = p as { title?: string; snippet?: string; description?: string; date?: string; posted_at?: string };
    return {
      title: post.title,
      snippet: post.snippet ?? post.description,
      date: post.date ?? post.posted_at,
    };
  });

  const recommendedTopics = [
    `${gbp.primaryCategory ?? "Service"} special in ${gbp.city ?? "your area"}`,
    "Before/after project highlight",
    "Seasonal tip for local homeowners",
    "Team spotlight + service area",
    "FAQ: pricing / same-day availability",
  ];

  if (posts.length === 0) {
    recommendedTopics.unshift("Publish your first GBP post this week — posts signal activity to Maps.");
  } else if (posts.length < 4) {
    recommendedTopics.unshift("Post weekly — competitors with 4+ recent posts often show stronger prominence.");
  }

  return { postCount: gbp.postCount ?? posts.length, recentPosts, recommendedTopics: recommendedTopics.slice(0, 6) };
}

export async function runPhotoAudit(
  gbp: GbpProfile,
  businessId: string,
  competitorPhotoAvg?: number
): Promise<PhotoAuditResult> {
  const { placeId } = await getBusinessIdentifiers(businessId);
  let photos: unknown[] = [];
  if (placeId) {
    try {
      photos = await placePhotos({ placeId });
    } catch {
      /* optional */
    }
  }

  const photoCount = gbp.photoCount ?? photos.length;
  const recommendations: string[] = [];

  if (photoCount < 10) {
    recommendations.push("Upload at least 10 GBP photos — trucks, team, before/after, and service area shots.");
  }
  if (competitorPhotoAvg && photoCount < competitorPhotoAvg) {
    recommendations.push(`Competitors average ${Math.round(competitorPhotoAvg)} photos — you have ${photoCount}.`);
  }
  if (photoCount < 25) {
    recommendations.push("Add 3–5 geo-tagged photos per week to close the prominence gap.");
  }

  return {
    photoCount,
    competitorAvg: competitorPhotoAvg,
    recommendations: recommendations.length ? recommendations : ["Photo count is competitive — keep uploading fresh project photos monthly."],
  };
}
