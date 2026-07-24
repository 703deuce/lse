import { subDays } from "date-fns";
import { createServiceClient } from "@/lib/db/client";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import {
  calcAvgRating,
  calcResponseRate,
  loadStoredReviews,
  reviewsInWindow,
  type StoredReviewRow,
} from "@/lib/reviews/review-store";
import {
  buildThemeBreakdown,
  classifyReviewSentiment,
  type ReviewThemeInput,
} from "@/lib/reviews/review-themes";

export type CompetitorLeaderboardRow = {
  id: string;
  name: string;
  isYou: boolean;
  totalReviews: number;
  rating: number | null;
  reviews30: number;
  reviews60: number;
  reviews90: number;
  reviewsPerMonth: number;
  momentumLabel: string;
  responseRate: number;
};

export type CompetitorGapRow = {
  competitorId: string;
  competitorName: string;
  totalGap: number;
  monthlyVelocityGap: number;
  neededToCatch: number;
  pace3Months: number;
  pace6Months: number;
  pace12Months: number;
  estimatedCatchUp: string;
  gapExpanding: boolean;
};

export type CompetitorThemeStrength = {
  label: string;
  count: number;
};

export type CompetitorContentComparison = {
  avgLength: number;
  pctWithText: number;
};

export type CompetitorIntelligenceData = {
  businessId: string;
  businessName: string;
  leaderboardRows: CompetitorLeaderboardRow[];
  gapRows: CompetitorGapRow[];
  strengths: {
    positive: CompetitorThemeStrength[];
    negative: CompetitorThemeStrength[];
    competitorPositive: CompetitorThemeStrength[];
    competitorNegative: CompetitorThemeStrength[];
  };
  contentComparison: {
    you: CompetitorContentComparison;
    competitors: CompetitorContentComparison;
  };
};

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

function storedToThemeInput(
  row: StoredReviewRow,
  meta: { businessName: string; isTarget: boolean }
): ReviewThemeInput {
  return {
    id: row.id,
    reviewerName: row.reviewer_name ?? "Anonymous",
    rating: row.rating != null ? Number(row.rating) : null,
    reviewText: row.review_text,
    reviewDate: row.review_date,
    businessName: meta.businessName,
    isTarget: meta.isTarget,
  };
}

function countSince(rows: StoredReviewRow[], days: number): number {
  return reviewsInWindow(rows, days).length;
}

function contentComparison(rows: StoredReviewRow[]): CompetitorContentComparison {
  if (!rows.length) return { avgLength: 0, pctWithText: 0 };
  const withText = rows.filter((row) => (row.review_text ?? "").trim().length > 0);
  const totalLength = withText.reduce((sum, row) => sum + (row.review_text ?? "").trim().length, 0);
  return {
    avgLength: withText.length ? Math.round(totalLength / withText.length) : 0,
    pctWithText: Math.round((withText.length / rows.length) * 100),
  };
}

function themeCounts(inputs: ReviewThemeInput[]): CompetitorThemeStrength[] {
  return buildThemeBreakdown(inputs)
    .slice(0, 8)
    .map((theme) => ({ label: theme.label, count: theme.reviewCount }));
}

export async function loadCompetitorIntelligenceData(
  businessId: string
): Promise<CompetitorIntelligenceData> {
  const supabase = createServiceClient();
  const [{ data: business }, momentum] = await Promise.all([
    supabase.from("businesses").select("id, name").eq("id", businessId).maybeSingle(),
    loadLatestMomentumRun(businessId),
  ]);

  if (!business) throw new Error("Business not found");

  const businessName = String(business.name ?? "Your business");
  const targetEntity = momentum?.entities.find((entity) => entity.entity_type === "target");
  const competitorEntities = momentum?.entities.filter((entity) => entity.entity_type === "competitor") ?? [];
  const competitorIds = competitorEntities.map((entity) => entity.competitor_id).filter(Boolean) as string[];

  const [targetRows180, allCompetitorRows180] = await Promise.all([
    loadStoredReviews(supabase, { businessId, lookbackDays: 180 }),
    competitorIds.length ? loadStoredReviews(supabase, { competitorIds, lookbackDays: 180 }) : Promise.resolve([]),
  ]);

  const rowsByCompetitor = new Map<string, StoredReviewRow[]>();
  for (const id of competitorIds) rowsByCompetitor.set(id, []);
  for (const row of allCompetitorRows180) {
    if (!row.competitor_id) continue;
    const rows = rowsByCompetitor.get(row.competitor_id) ?? [];
    rows.push(row);
    rowsByCompetitor.set(row.competitor_id, rows);
  }

  const targetRows90 = reviewsInWindow(targetRows180, 90);
  const targetReviews30 = countSince(targetRows180, 30);
  const targetReviews60 = countSince(targetRows180, 60);
  const targetTotal = Number(targetEntity?.total_reviews_current ?? targetRows180.length);
  const targetMonthlyVelocity = targetReviews30;

  const leaderboardRows: CompetitorLeaderboardRow[] = [
    {
      id: businessId,
      name: businessName,
      isYou: true,
      totalReviews: targetTotal,
      rating: targetEntity?.rating_current != null ? Number(targetEntity.rating_current) : calcAvgRating(targetRows90),
      reviews30: targetReviews30,
      reviews60: targetReviews60,
      reviews90: targetRows90.length,
      reviewsPerMonth: round1(targetRows90.length / 3),
      momentumLabel: String(targetEntity?.momentum_label ?? "Stable"),
      responseRate: calcResponseRate(targetRows90),
    },
    ...competitorEntities.map((entity) => {
      const rows = entity.competitor_id ? rowsByCompetitor.get(entity.competitor_id) ?? [] : [];
      const rows90 = reviewsInWindow(rows, 90);
      return {
        id: entity.competitor_id ?? entity.id,
        name: String(entity.name ?? "Competitor"),
        isYou: false,
        totalReviews: Number(entity.total_reviews_current ?? rows.length),
        rating: entity.rating_current != null ? Number(entity.rating_current) : calcAvgRating(rows90),
        reviews30: countSince(rows, 30),
        reviews60: countSince(rows, 60),
        reviews90: rows90.length,
        reviewsPerMonth: round1(rows90.length / 3),
        momentumLabel: String(entity.momentum_label ?? "Stable"),
        responseRate: calcResponseRate(rows90),
      };
    }),
  ].sort((a, b) => b.totalReviews - a.totalReviews);

  const gapRows: CompetitorGapRow[] = competitorEntities.map((entity) => {
    const id = entity.competitor_id ?? entity.id;
    const rows = entity.competitor_id ? rowsByCompetitor.get(entity.competitor_id) ?? [] : [];
    const totalReviews = Number(entity.total_reviews_current ?? rows.length);
    const competitorVelocity = countSince(rows, 30);
    const totalGap = totalReviews - targetTotal;
    const monthlyVelocityGap = competitorVelocity - targetMonthlyVelocity;
    const neededToCatch = Math.max(0, totalGap + 1);
    const relativeMonthlyGain = targetMonthlyVelocity - competitorVelocity;
    const estimatedCatchUp =
      neededToCatch <= 0
        ? "Caught up"
        : relativeMonthlyGain > 0
          ? `${Math.ceil(neededToCatch / relativeMonthlyGain)} mo`
          : "Not at current pace";
    const projectedGap = (months: number) =>
      Math.round(totalReviews + competitorVelocity * months - (targetTotal + targetMonthlyVelocity * months));

    return {
      competitorId: id,
      competitorName: String(entity.name ?? "Competitor"),
      totalGap,
      monthlyVelocityGap,
      neededToCatch,
      pace3Months: projectedGap(3),
      pace6Months: projectedGap(6),
      pace12Months: projectedGap(12),
      estimatedCatchUp,
      gapExpanding: monthlyVelocityGap > 0,
    };
  });

  const competitorNameById = new Map(
    competitorEntities.map((entity) => [entity.competitor_id ?? entity.id, String(entity.name ?? "Competitor")])
  );
  const competitorRows90 = allCompetitorRows180.filter((row) => {
    if (!row.review_date) return false;
    return new Date(row.review_date) >= subDays(new Date(), 90);
  });

  const targetThemeInputs = targetRows90.map((row) =>
    storedToThemeInput(row, { businessName, isTarget: true })
  );
  const competitorThemeInputs = competitorRows90.map((row) =>
    storedToThemeInput(row, {
      businessName: competitorNameById.get(row.competitor_id ?? "") ?? "Competitor",
      isTarget: false,
    })
  );

  const positiveTarget = targetThemeInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "positive"
  );
  const negativeTarget = targetThemeInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "negative"
  );
  const positiveCompetitors = competitorThemeInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "positive"
  );
  const negativeCompetitors = competitorThemeInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "negative"
  );

  return {
    businessId,
    businessName,
    leaderboardRows,
    gapRows,
    strengths: {
      positive: themeCounts(positiveTarget),
      negative: themeCounts(negativeTarget),
      competitorPositive: themeCounts(positiveCompetitors),
      competitorNegative: themeCounts(negativeCompetitors),
    },
    contentComparison: {
      you: contentComparison(targetRows90),
      competitors: contentComparison(competitorRows90),
    },
  };
}
