import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";

function review(
  id: string,
  overrides: Partial<ReviewListItem> & Pick<ReviewListItem, "reviewerName">
): ReviewListItem {
  return {
    id,
    reviewerName: overrides.reviewerName,
    rating: overrides.rating ?? 5,
    reviewText:
      overrides.reviewText ??
      "Great experience from start to finish. The team was professional, on time, and explained everything clearly.",
    reviewDate: overrides.reviewDate ?? "2026-06-18",
    relativeDate: overrides.relativeDate ?? "3 weeks ago",
    source: overrides.source ?? "google",
    tags: overrides.tags ?? ["friendly staff", "clean office"],
    replied: overrides.replied ?? true,
    ownerResponseText: overrides.ownerResponseText ?? null,
    isTarget: overrides.isTarget ?? true,
    businessName: overrides.businessName ?? "Bright Smile Dental",
    competitorId: overrides.competitorId ?? null,
    daysWaiting: overrides.daysWaiting ?? null,
    urgency: overrides.urgency ?? null,
  };
}

export const REVIEWS_PREVIEW_DATA: ReviewsPageData = {
  businessId: "preview",
  businessName: "Bright Smile Dental",
  hasData: true,
  lastSyncedAt: "2026-07-10T12:00:00.000Z",
  kpis: {
    avgRating: 4.8,
    avgRatingDelta: 0.2,
    totalReviews: 123,
    newReviews90d: 18,
    newReviews90dDelta: 4,
    reviewGap: 12,
    responseRate: 92,
    responseRateDelta: 5,
    unanswered90d: 2,
    avgDaysWaiting: 3,
    urgentCount: 1,
  },
  latestTargetReviews: [
    review("r1", { reviewerName: "Sarah Mitchell" }),
    review("r2", { reviewerName: "James Carter", rating: 4 }),
    review("r3", { reviewerName: "Emily Nguyen", replied: false }),
  ],
  competitorActivity: [
    { id: "c1", name: "Downtown Dental", rating: 4.6, newReviews90d: 9, spark: [2, 3, 4, 5, 6, 7, 9] },
    { id: "c2", name: "Family Smiles", rating: 4.4, newReviews90d: 6, spark: [1, 2, 2, 3, 4, 5, 6] },
  ],
  topKeywords: [
    { keyword: "friendly staff", count: 14 },
    { keyword: "short wait", count: 9 },
    { keyword: "clean office", count: 8 },
  ],
  competitorWinningKeywords: [
    { keyword: "same-day appointments", count: 11 },
    { keyword: "insurance help", count: 7 },
    { keyword: "parking", count: 5 },
  ],
  fastestGrowingCompetitor: { name: "Downtown Dental", rating: 4.6, delta: 9 },
  stream: [
    review("s1", { reviewerName: "Sarah Mitchell" }),
    review("s2", { reviewerName: "James Carter", rating: 4, isTarget: false, businessName: "Downtown Dental" }),
    review("s3", { reviewerName: "Emily Nguyen", replied: false }),
    review("s4", { reviewerName: "Michael Brooks", rating: 5 }),
    review("s5", { reviewerName: "Lisa Tran", rating: 3, replied: false }),
    review("s6", { reviewerName: "Chris Allen", rating: 5, isTarget: false, businessName: "Family Smiles" }),
    review("s7", { reviewerName: "Priya Shah", rating: 4 }),
    review("s8", { reviewerName: "Daniel Ortiz", rating: 5 }),
    review("s9", { reviewerName: "Amy Lewis", rating: 2, replied: false }),
    review("s10", { reviewerName: "Kevin Park", rating: 5 }),
  ],
  yourReviews: [
    review("y1", { reviewerName: "Sarah Mitchell" }),
    review("y2", { reviewerName: "Emily Nguyen", replied: false }),
    review("y3", { reviewerName: "Michael Brooks", rating: 5 }),
  ],
  competitors: [],
  competitorReviews: [],
  keywordGaps: [],
  trendingKeywords: [],
  positivePct: 82,
  negativePct: 8,
  themeMovement: [],
  sentiment: {
    yours: {
      sentiment: {
        positive: 82,
        negative: 8,
        neutral: 10,
        total: 50,
        positivePct: 82,
        negativePct: 8,
        neutralPct: 10,
      },
      themes: [
        { themeId: "staff_crew", label: "Friendly Staff", reviewCount: 14, pct: 28 },
        { themeId: "service_quality", label: "Service Quality", reviewCount: 11, pct: 22 },
        { themeId: "ease_convenience", label: "Easy Scheduling", reviewCount: 8, pct: 16 },
      ],
    },
    competitors: [],
    entities: [],
    marketSentiment: {
      positive: 74,
      negative: 12,
      neutral: 14,
      total: 120,
      positivePct: 74,
      negativePct: 12,
      neutralPct: 14,
    },
    themeComparison: [],
    themeMovement: [],
    entityMovement: [],
    insights: [],
  },
  unanswered: [
    review("u1", {
      reviewerName: "Emily Nguyen",
      replied: false,
      daysWaiting: 5,
      urgency: "medium",
    }),
    review("u2", {
      reviewerName: "Amy Lewis",
      rating: 2,
      replied: false,
      daysWaiting: 9,
      urgency: "high",
    }),
  ],
  suggestions: [
    {
      id: "s1",
      title: "Reply to 2 unanswered reviews",
      description: "Improve response rate and show you care about feedback.",
      type: "reply",
    },
    {
      id: "s2",
      title: "Request reviews from recent patients",
      description: "You are 12 reviews behind the top 3 competitors.",
      type: "request",
    },
  ],
  syncState: { needsRun: false, message: null },
};
