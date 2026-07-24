import type { ReviewListItem, ReviewsPageData } from "@/lib/reviews/reviews-page-data";

export const REVIEW_FEED_PREVIEW_BUSINESS_ID = "preview-review-feed";

export type ReviewFeedDetails = {
  reviewId: string;
  publishedDateTime: string;
  location: string;
  lastEditedAt: string | null;
  edited?: boolean;
  sentiment: {
    label: "Positive" | "Neutral" | "Negative";
    confidence: number;
  };
};

export type ReviewFeedDashboardData = ReviewsPageData & {
  feedSummary?: {
    totalReviews: number;
    newReviews: number;
    starCounts: {
      5: number;
      4: number;
      3: number;
      2: number;
      1: number;
    };
    withResponse: number;
    noResponse: number;
  };
  feedDetails?: Record<string, ReviewFeedDetails>;
};

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
      "A-Team Junk Removal made the whole process painless. The crew arrived on time, explained pricing clearly, and had the garage cleaned out faster than expected.",
    reviewDate: overrides.reviewDate ?? "2024-06-25",
    publishedAt: overrides.publishedAt ?? "2024-06-25T15:42:00.000Z",
    firstObservedAt: overrides.firstObservedAt ?? "2024-06-25T16:00:00.000Z",
    relativeDate: overrides.relativeDate ?? "2 hours ago",
    source: overrides.source ?? "google",
    tags: overrides.tags ?? ["fast pickup", "professional crew", "fair pricing"],
    replied: overrides.replied ?? true,
    ownerResponseText: overrides.ownerResponseText ?? "Thank you for choosing A-Team Junk Removal. We appreciate the kind words!",
    isTarget: true,
    businessName: "A-Team Junk Removal",
    competitorId: null,
    daysWaiting: overrides.daysWaiting ?? null,
    urgency: overrides.urgency ?? null,
    isNew: overrides.isNew ?? true,
    resolved: overrides.resolved ?? false,
    resolvedAt: overrides.resolvedAt ?? null,
    campaignAttribution: overrides.campaignAttribution ?? null,
  };
}

const reviews: ReviewListItem[] = [
  review("g-100284", {
    reviewerName: "Sarah Mitchell",
    rating: 5,
    tags: ["same-day service", "friendly crew", "garage cleanout"],
    reviewText:
      "Booked in the morning and they were at my house that afternoon. The team was friendly, careful around the walls, and swept the garage before leaving.",
    publishedAt: "2024-06-25T15:42:00.000Z",
    relativeDate: "2 hours ago",
  }),
  review("g-100283", {
    reviewerName: "Daniel Cho",
    rating: 4,
    tags: ["clear pricing", "on time"],
    reviewText:
      "Good communication and fair pricing. They arrived inside the quoted window and removed an old sectional without any damage.",
    publishedAt: "2024-06-25T11:18:00.000Z",
    relativeDate: "6 hours ago",
    ownerResponseText: null,
    replied: false,
    daysWaiting: 0,
  }),
  review("g-100282", {
    reviewerName: "Monica Alvarez",
    rating: 5,
    tags: ["estate cleanout", "hard working", "respectful"],
    reviewText:
      "We used A-Team for a difficult estate cleanout. They were respectful, hard working, and kept us updated throughout the job.",
    publishedAt: "2024-06-24T19:06:00.000Z",
    relativeDate: "1 day ago",
  }),
  review("g-100281", {
    reviewerName: "Kevin Brooks",
    rating: 3,
    tags: ["arrival window", "pricing"],
    reviewText:
      "The removal itself was fine, but the crew showed up later than expected. Pricing was clear once they arrived.",
    publishedAt: "2024-06-23T21:40:00.000Z",
    relativeDate: "2 days ago",
    ownerResponseText: null,
    replied: false,
    daysWaiting: 2,
    urgency: "medium",
  }),
  review("g-100280", {
    reviewerName: "Priya Shah",
    rating: 5,
    tags: ["construction debris", "quick response"],
    reviewText:
      "They hauled away construction debris from a kitchen project and were much faster than the other companies I called.",
    publishedAt: "2024-06-22T17:24:00.000Z",
    relativeDate: "3 days ago",
    isNew: false,
  }),
  review("g-100279", {
    reviewerName: "Robert Miller",
    rating: 2,
    tags: ["missed item", "follow-up"],
    reviewText:
      "They missed a few items from the side yard and I had to call back. The office was helpful, but it took an extra trip.",
    publishedAt: "2024-06-21T13:32:00.000Z",
    relativeDate: "4 days ago",
    ownerResponseText: null,
    replied: false,
    daysWaiting: 4,
    urgency: "high",
    isNew: false,
  }),
  review("g-100278", {
    reviewerName: "Emily Watson",
    rating: 5,
    tags: ["appliance removal", "professional crew"],
    reviewText:
      "Great experience removing a refrigerator and washer. They protected the floors and were very professional.",
    publishedAt: "2024-06-20T14:12:00.000Z",
    relativeDate: "5 days ago",
    isNew: false,
  }),
  review("g-100277", {
    reviewerName: "Marcus Lee",
    rating: 4,
    tags: ["yard debris", "friendly staff"],
    reviewText:
      "Friendly staff and easy scheduling for yard debris pickup. I would use them again.",
    publishedAt: "2024-06-19T10:05:00.000Z",
    relativeDate: "6 days ago",
    isNew: false,
  }),
];

export const reviewFeedPreviewData: ReviewFeedDashboardData = {
  businessId: REVIEW_FEED_PREVIEW_BUSINESS_ID,
  businessName: "A-Team Junk Removal",
  hasData: true,
  lastSyncedAt: "2024-06-25T17:10:00.000Z",
  feedSummary: {
    totalReviews: 327,
    newReviews: 12,
    starCounts: {
      5: 214,
      4: 68,
      3: 28,
      2: 10,
      1: 7,
    },
    withResponse: 268,
    noResponse: 59,
  },
  feedDetails: {
    "g-100284": {
      reviewId: "google:ChZDSUhNMG9nS0VJQ0FnSUR6aWVmR0l3",
      publishedDateTime: "2024-06-25T15:42:00.000Z",
      location: "A-Team Junk Removal - Raleigh",
      lastEditedAt: null,
      sentiment: { label: "Positive", confidence: 97 },
    },
    "g-100283": {
      reviewId: "google:ChdDSUhNMG9nS0VJQ0FnSUR6eHUtWjFBRR",
      publishedDateTime: "2024-06-25T11:18:00.000Z",
      location: "A-Team Junk Removal - Raleigh",
      lastEditedAt: "2024-06-25T12:04:00.000Z",
      edited: true,
      sentiment: { label: "Positive", confidence: 82 },
    },
    "g-100282": {
      reviewId: "google:ChRDSUhNMG9nS0VJQ0FnSUR6eDV1aRAB",
      publishedDateTime: "2024-06-24T19:06:00.000Z",
      location: "A-Team Junk Removal - Cary",
      lastEditedAt: null,
      sentiment: { label: "Positive", confidence: 96 },
    },
    "g-100281": {
      reviewId: "google:ChNDSUhNMG9nS0VJQ0FnSUR6a0t6MRAB",
      publishedDateTime: "2024-06-23T21:40:00.000Z",
      location: "A-Team Junk Removal - Raleigh",
      lastEditedAt: null,
      sentiment: { label: "Neutral", confidence: 77 },
    },
    "g-100280": {
      reviewId: "google:ChJDSUhNMG9nS0VJQ0FnSUR6X1FmY0l3",
      publishedDateTime: "2024-06-22T17:24:00.000Z",
      location: "A-Team Junk Removal - Durham",
      lastEditedAt: null,
      sentiment: { label: "Positive", confidence: 94 },
    },
    "g-100279": {
      reviewId: "google:ChVDSUhNMG9nS0VJQ0FnSUR6b3RtR0NR",
      publishedDateTime: "2024-06-21T13:32:00.000Z",
      location: "A-Team Junk Removal - Raleigh",
      lastEditedAt: "2024-06-21T14:11:00.000Z",
      edited: true,
      sentiment: { label: "Negative", confidence: 89 },
    },
  },
  kpis: {
    avgRating: 4.6,
    avgRatingDelta: 0.1,
    totalReviews: 327,
    newReviews90d: 71,
    newReviews90dDelta: 8,
    reviewGap: 215,
    responseRate: 82,
    responseRateDelta: 4,
    unanswered90d: 59,
    avgDaysWaiting: 2.8,
    urgentCount: 7,
  },
  latestTargetReviews: reviews.slice(0, 3),
  competitorActivity: [],
  topKeywords: [
    { keyword: "same-day service", count: 42 },
    { keyword: "professional crew", count: 38 },
    { keyword: "fair pricing", count: 31 },
  ],
  competitorWinningKeywords: [],
  fastestGrowingCompetitor: null,
  stream: reviews,
  yourReviews: reviews,
  competitors: [],
  competitorReviews: [],
  keywordGaps: [],
  trendingKeywords: [],
  positivePct: 84,
  negativePct: 7,
  themeMovement: [],
  sentiment: {
    yours: {
      sentiment: {
        positive: 275,
        negative: 23,
        neutral: 29,
        total: 327,
        positivePct: 84,
        negativePct: 7,
        neutralPct: 9,
      },
      themes: [
        { themeId: "speed_scheduling", label: "Same-day service", reviewCount: 42, pct: 13 },
        { themeId: "professionalism", label: "Professional crew", reviewCount: 38, pct: 12 },
        { themeId: "pricing_value", label: "Fair pricing", reviewCount: 31, pct: 9 },
      ],
    },
    competitors: [],
    entities: [],
    marketSentiment: {
      positive: 0,
      negative: 0,
      neutral: 0,
      total: 0,
      positivePct: 0,
      negativePct: 0,
      neutralPct: 0,
    },
    themeComparison: [],
    themeMovement: [],
    entityMovement: [],
    insights: [],
  },
  unanswered: reviews.filter((row) => !row.replied),
  suggestions: [
    {
      id: "reply-no-response",
      title: "Reply to 59 unanswered reviews",
      description: "Prioritize the newest low-rating reviews first.",
      type: "reply",
    },
  ],
  syncState: { needsRun: false, message: null },
};
