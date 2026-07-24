import { differenceInCalendarDays, subDays } from "date-fns";
import { createServiceClient } from "@/lib/db/client";
import { auditOwnerResponses } from "@/lib/reputation/response-audit";
import {
  loadStoredReviews,
  reviewsInWindow,
  storedRowToNormalized,
  type StoredReviewRow,
} from "@/lib/reviews/review-store";
import {
  buildThemeBreakdown,
  classifyReviewSentiment,
  extractThemeTagsFromText,
  type ReviewThemeInput,
} from "@/lib/reviews/review-themes";

export type ReviewInsightTheme = {
  label: string;
  count: number;
  pct: number;
};

export type ReviewInsightsData = {
  businessId: string;
  businessName: string;
  themes: {
    positive: ReviewInsightTheme[];
    negative: ReviewInsightTheme[];
    emerging: Array<ReviewInsightTheme & { delta: number }>;
  };
  servicesAndKeywords: Array<{ keyword: string; count: number }>;
  responsePerformance: {
    responseRate: number;
    totalWithText: number;
    answered: number;
    unansweredPositive: number;
    unansweredNegative: number;
    unansweredNeutral: number;
    avgResponseTimeDays: number | null;
  };
  responseQuality: {
    genericResponseSuspected: number;
    genericResponsePct: number;
  };
};

type ResponseTimingRow = {
  id: string;
  review_date: string | null;
  published_at?: string | null;
  owner_responded_at?: string | null;
  owner_response_text: string | null;
};

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "also",
  "been",
  "business",
  "company",
  "could",
  "from",
  "great",
  "have",
  "just",
  "really",
  "service",
  "that",
  "their",
  "them",
  "they",
  "this",
  "very",
  "were",
  "what",
  "when",
  "with",
  "would",
  "your",
]);

function storedToThemeInput(row: StoredReviewRow, businessName: string): ReviewThemeInput {
  return {
    id: row.id,
    reviewerName: row.reviewer_name ?? "Anonymous",
    rating: row.rating != null ? Number(row.rating) : null,
    reviewText: row.review_text,
    reviewDate: row.review_date,
    businessName,
    isTarget: true,
  };
}

function mapThemeBreakdown(inputs: ReviewThemeInput[]): ReviewInsightTheme[] {
  return buildThemeBreakdown(inputs).map((theme) => ({
    label: theme.label,
    count: theme.reviewCount,
    pct: theme.pct,
  }));
}

function extractKeywordMentions(rows: StoredReviewRow[]): Array<{ keyword: string; count: number }> {
  const counts = new Map<string, number>();

  for (const row of rows) {
    for (const tag of extractThemeTagsFromText(row.review_text, 4)) {
      counts.set(tag, (counts.get(tag) ?? 0) + 1);
    }

    const text = (row.review_text ?? "").toLowerCase();
    const words = text.match(/[a-z][a-z'-]{3,}/g) ?? [];
    const uniqueWords = new Set(words.filter((word) => !STOP_WORDS.has(word)));
    for (const word of uniqueWords) {
      counts.set(word, (counts.get(word) ?? 0) + 1);
    }
  }

  return Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 20)
    .map(([keyword, count]) => ({ keyword, count }));
}

async function loadResponseTimingRows(businessId: string): Promise<ResponseTimingRow[]> {
  const supabase = createServiceClient();
  const cutoff = subDays(new Date(), 90).toISOString().slice(0, 10);
  const withExactColumns = await supabase
    .from("business_reviews")
    .select("id, review_date, published_at, owner_responded_at, owner_response_text")
    .eq("business_id", businessId)
    .gte("review_date", cutoff)
    .order("review_date", { ascending: false })
    .limit(500);

  if (!withExactColumns.error) {
    return (withExactColumns.data ?? []) as ResponseTimingRow[];
  }

  const fallback = await supabase
    .from("business_reviews")
    .select("id, review_date, owner_response_text")
    .eq("business_id", businessId)
    .gte("review_date", cutoff)
    .order("review_date", { ascending: false })
    .limit(500);

  return (fallback.data ?? []) as ResponseTimingRow[];
}

function avgResponseTimeDays(rows: ResponseTimingRow[]): number | null {
  const durations: number[] = [];
  for (const row of rows) {
    if (!row.owner_response_text?.trim() || !row.owner_responded_at) continue;
    const published = row.published_at ?? (row.review_date ? `${row.review_date}T00:00:00Z` : null);
    if (!published) continue;
    const days = differenceInCalendarDays(new Date(row.owner_responded_at), new Date(published));
    if (Number.isFinite(days) && days >= 0) durations.push(days);
  }
  if (!durations.length) return null;
  return Math.round((durations.reduce((sum, days) => sum + days, 0) / durations.length) * 10) / 10;
}

export async function loadReviewInsightsData(businessId: string): Promise<ReviewInsightsData> {
  const supabase = createServiceClient();
  const { data: business } = await supabase
    .from("businesses")
    .select("id, name")
    .eq("id", businessId)
    .maybeSingle();

  if (!business) throw new Error("Business not found");
  const businessName = String(business.name ?? "Your business");

  const [storedRows, timingRows] = await Promise.all([
    loadStoredReviews(supabase, { businessId, lookbackDays: 180 }),
    loadResponseTimingRows(businessId),
  ]);

  const currentRows = reviewsInWindow(storedRows, 90);
  const priorRows = storedRows.filter((row) => {
    if (!row.review_date) return false;
    const date = new Date(row.review_date);
    const now = new Date();
    return date >= subDays(now, 180) && date < subDays(now, 90);
  });

  const currentInputs = currentRows.map((row) => storedToThemeInput(row, businessName));
  const positiveInputs = currentInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "positive"
  );
  const negativeInputs = currentInputs.filter((review) =>
    classifyReviewSentiment(review.reviewText, review.rating) === "negative"
  );

  const currentThemes = mapThemeBreakdown(currentInputs);
  const priorThemeCounts = new Map(
    mapThemeBreakdown(priorRows.map((row) => storedToThemeInput(row, businessName))).map((theme) => [
      theme.label,
      theme.count,
    ])
  );
  const emerging = currentThemes
    .map((theme) => ({ ...theme, delta: theme.count - (priorThemeCounts.get(theme.label) ?? 0) }))
    .filter((theme) => theme.delta > 0)
    .sort((a, b) => b.delta - a.delta || b.count - a.count)
    .slice(0, 8);

  const responseAudit = auditOwnerResponses(currentRows.map(storedRowToNormalized));
  const genericPct =
    responseAudit.answered > 0
      ? Math.round((responseAudit.genericResponseSuspected / responseAudit.answered) * 100)
      : 0;

  return {
    businessId,
    businessName,
    themes: {
      positive: mapThemeBreakdown(positiveInputs).slice(0, 8),
      negative: mapThemeBreakdown(negativeInputs).slice(0, 8),
      emerging,
    },
    servicesAndKeywords: extractKeywordMentions(currentRows),
    responsePerformance: {
      responseRate: responseAudit.responseRate,
      totalWithText: responseAudit.totalWithText,
      answered: responseAudit.answered,
      unansweredPositive: responseAudit.unansweredPositive,
      unansweredNegative: responseAudit.unansweredNegative,
      unansweredNeutral: responseAudit.unansweredNeutral,
      avgResponseTimeDays: avgResponseTimeDays(timingRows),
    },
    responseQuality: {
      genericResponseSuspected: responseAudit.genericResponseSuspected,
      genericResponsePct: genericPct,
    },
  };
}
