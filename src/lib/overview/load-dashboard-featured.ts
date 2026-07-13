import { createServiceClient } from "@/lib/db/client";
import { loadAiVisibilityData } from "@/lib/ai-visibility/engine";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { buildMarketInsightsFromEntityRows } from "@/lib/reviews/market-insights";
import { loadLatestReputationAudit } from "@/lib/reputation/engine";
import type { AiEngine } from "@/lib/ai-visibility/types";
import { ENGINE_LABELS } from "@/lib/ai-visibility/types";

export type DashboardReviewPerformance = {
  rating: number | null;
  newReviews90d: number;
  weeklyPaceGap: number | null;
  yourSharePct: number;
  top3SharePct: number;
  trend: number[];
  hasData: boolean;
};

export type DashboardAiVisibility = {
  hasData: boolean;
  engines: Array<{ engine: AiEngine; label: string; mentioned: boolean }>;
  topMentions: string[];
  companyCount: number;
};

export type DashboardLocalOpportunity = {
  id: string;
  title: string;
};

export type DashboardFeaturedData = {
  review: DashboardReviewPerformance;
  ai: DashboardAiVisibility;
  local: {
    hasData: boolean;
    items: DashboardLocalOpportunity[];
    total: number;
  };
};

const DISPLAY_ENGINES: AiEngine[] = ["chatgpt", "gemini", "claude", "perplexity"];

export async function loadDashboardFeatured(businessId: string): Promise<DashboardFeaturedData> {
  const supabase = createServiceClient();

  const [reputation, momentum, aiData, localRes] = await Promise.all([
    loadLatestReputationAudit(businessId),
    loadLatestMomentumRun(businessId),
    loadAiVisibilityData(businessId).catch(() => null),
    supabase
      .from("local_trust_opportunities")
      .select("id, title", { count: "exact" })
      .eq("business_id", businessId)
      .order("relevance_score", { ascending: false })
      .limit(3),
  ]);

  const target = momentum?.entities.find((e) => e.entity_type === "target");
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
  const top3Share = Math.min(
    100,
    Math.max(yourShare, 100 - yourShare) // visual competitor bar vs you
  );

  const review: DashboardReviewPerformance = {
    rating: reputation?.audit?.rating != null ? Number(reputation.audit.rating) : null,
    newReviews90d:
      (reputation?.audit?.reviews_30d as number | undefined) ??
      target?.reviews_30d ??
      0,
    weeklyPaceGap: market?.weeklyPaceGap ?? null,
    yourSharePct: yourShare,
    top3SharePct: top3Share,
    trend,
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
  } else if (aiData?.latestRun?.target_mentioned) {
    DISPLAY_ENGINES.forEach((e) => engineMentioned.set(e, true));
  }

  const ai: DashboardAiVisibility = {
    hasData: Boolean(aiData?.runs?.some((r) => r.status === "complete")),
    engines: DISPLAY_ENGINES.map((engine) => ({
      engine,
      label: ENGINE_LABELS[engine],
      mentioned: engineMentioned.get(engine) ?? false,
    })),
    topMentions: (aiData?.mentionLeaderboard ?? [])
      .filter((m) => !m.isTargetBrand)
      .slice(0, 3)
      .map((m) => m.displayName),
    companyCount: aiData?.runs?.[0]?.companyCount ?? aiData?.mentionLeaderboard?.length ?? 0,
  };

  const localItems = (localRes.data ?? []).map((o) => ({
    id: o.id as string,
    title: o.title as string,
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
