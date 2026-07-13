import { createServiceClient } from "@/lib/db/client";
import { loadAiVisibilityData } from "@/lib/ai-visibility/engine";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { buildMarketInsightsFromEntityRows } from "@/lib/reviews/market-insights";
import { loadLatestReputationAudit } from "@/lib/reputation/engine";
import { ENGINE_LABELS } from "@/lib/ai-visibility/types";
import type { AiEngine } from "@/lib/ai-visibility/types";
import type { MomentumLabel } from "@/lib/reviews/metrics";
import {
  formatOpportunityType,
  type DashboardAiVisibility,
  type DashboardFeaturedData,
  type DashboardLatestReview,
  type DashboardLocalOpportunity,
  type DashboardReviewPerformance,
} from "@/lib/overview/dashboard-featured-types";

export type {
  DashboardAiMention,
  DashboardAiVisibility,
  DashboardFeaturedData,
  DashboardLatestReview,
  DashboardLocalOpportunity,
  DashboardReviewPerformance,
  DashboardTopCompetitor,
} from "@/lib/overview/dashboard-featured-types";

const DISPLAY_ENGINES: AiEngine[] = ["chatgpt", "gemini", "claude", "perplexity"];

export async function loadDashboardFeatured(businessId: string): Promise<DashboardFeaturedData> {
  const supabase = createServiceClient();

  const [reputation, momentum, aiData, localRes, latestReviewRes] = await Promise.all([
    loadLatestReputationAudit(businessId),
    loadLatestMomentumRun(businessId),
    loadAiVisibilityData(businessId).catch(() => null),
    supabase
      .from("local_trust_opportunities")
      .select(
        "id, title, opportunity_type, priority, suggested_action, evidence_snippet, domain",
        { count: "exact" }
      )
      .eq("business_id", businessId)
      .order("relevance_score", { ascending: false })
      .limit(4),
    supabase
      .from("review_records")
      .select("reviewer_name, rating, review_text, relative_date_text, owner_response_present")
      .eq("business_id", businessId)
      .not("review_text", "is", null)
      .order("fetched_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const target = momentum?.entities.find((e) => e.entity_type === "target");
  const competitors = momentum?.entities.filter((e) => e.entity_type === "competitor") ?? [];
  const topMomentumCompetitor = [...competitors].sort(
    (a, b) => (b.reviews_30d ?? 0) - (a.reviews_30d ?? 0)
  )[0];

  const metricsJson = target?.metrics_json as Record<string, unknown> | undefined;
  const market =
    (metricsJson?.marketInsights as ReturnType<typeof buildMarketInsightsFromEntityRows>) ??
    (momentum?.entities ? buildMarketInsightsFromEntityRows(momentum.entities) : null);

  const trendBuckets =
    (metricsJson?.trendBuckets90d as Array<{ count: number }> | undefined) ?? [];
  const trend = trendBuckets.length
    ? trendBuckets.slice(0, 6).map((b) => b.count)
    : [0, 1, 1, 2, 2, target?.reviews_30d ?? 0];

  const yourShare = market?.targetSharePct30d ?? 0;
  const top3Reviews = competitors
    .sort((a, b) => (b.reviews_30d ?? 0) - (a.reviews_30d ?? 0))
    .slice(0, 3)
    .reduce((sum, c) => sum + (c.reviews_30d ?? 0), 0);
  const yourReviews30 = target?.reviews_30d ?? 0;
  const total30 = yourReviews30 + top3Reviews;
  const top3SharePct = total30 > 0 ? Math.round((top3Reviews / total30) * 100) : 0;

  const repReview = reputation?.targetReviews?.[0];
  const latestRow = latestReviewRes.data ?? repReview;
  const latestReview: DashboardLatestReview | null = latestRow
    ? {
        reviewerName:
          (latestRow.reviewer_name as string | null) ??
          (latestRow as { reviewerName?: string }).reviewerName ??
          "Customer",
        rating: latestRow.rating != null ? Number(latestRow.rating) : null,
        reviewText: ((latestRow.review_text as string | null) ?? "").trim(),
        relativeDate: (latestRow.relative_date_text as string | null) ?? null,
        replied: Boolean(
          latestRow.owner_response_present ??
            (latestRow as { owner_response_present?: boolean }).owner_response_present
        ),
      }
    : null;

  const review: DashboardReviewPerformance = {
    rating: reputation?.audit?.rating != null ? Number(reputation.audit.rating) : null,
    totalReviews: (reputation?.audit?.total_reviews as number | undefined) ?? 0,
    newReviews90d:
      (reputation?.audit?.reviews_30d as number | undefined) ?? target?.reviews_30d ?? 0,
    responseRate:
      reputation?.audit?.response_rate != null
        ? Math.round(Number(reputation.audit.response_rate))
        : null,
    momentumLabel: (target?.momentum_label as MomentumLabel | null) ?? null,
    weeklyPaceGap: market?.weeklyPaceGap ?? null,
    yourSharePct: yourShare,
    top3SharePct,
    trend,
    latestReview: latestReview?.reviewText ? latestReview : null,
    topCompetitor: topMomentumCompetitor
      ? {
          name: topMomentumCompetitor.name,
          reviews30d: topMomentumCompetitor.reviews_30d ?? 0,
          rating:
            topMomentumCompetitor.rating != null ? Number(topMomentumCompetitor.rating) : null,
        }
      : null,
    hasData: Boolean(reputation?.audit || target),
  };

  const engineMentioned = new Map<AiEngine, boolean>();
  if (aiData?.engineResults) {
    for (const er of aiData.engineResults as Array<{
      engine: AiEngine;
      target_mentioned?: boolean;
    }>) {
      if (er.target_mentioned) engineMentioned.set(er.engine, true);
    }
  }

  const latestRun = aiData?.runs?.find((r) => r.status === "complete") ?? null;

  const ai: DashboardAiVisibility = {
    hasData: Boolean(latestRun),
    visibilityScore: latestRun?.visibility_score ?? null,
    lastRunAt: latestRun?.finished_at ?? latestRun?.created_at ?? null,
    targetMentioned: Boolean(latestRun?.target_mentioned),
    engines: DISPLAY_ENGINES.map((engine) => ({
      engine,
      label: ENGINE_LABELS[engine],
      mentioned: engineMentioned.get(engine) ?? false,
    })),
    mentions: (aiData?.mentionLeaderboard ?? []).slice(0, 6).map((m) => ({
      name: m.displayName,
      sharePct: m.sharePct,
      engineCount: m.engineCount,
      isTarget: m.isTargetBrand,
    })),
    companyCount: latestRun?.companyCount ?? aiData?.mentionLeaderboard?.length ?? 0,
    primaryPrompt:
      (aiData?.primaryPrompt?.prompt_text as string | undefined) ??
      aiData?.activePrompts?.[0]?.prompt_text ??
      null,
  };

  const localItems: DashboardLocalOpportunity[] = (localRes.data ?? []).map((o) => ({
    id: o.id as string,
    title: o.title as string,
    opportunityType: formatOpportunityType(o.opportunity_type as string),
    priority: (o.priority as string) ?? "medium",
    suggestedAction: (o.suggested_action as string | null) ?? null,
    evidenceSnippet: (o.evidence_snippet as string | null) ?? null,
    domain: (o.domain as string | null) ?? null,
  }));

  return {
    review,
    ai,
    local: {
      hasData: localItems.length > 0,
      items: localItems,
      total: localRes.count ?? localItems.length,
    },
  };
}
