import { formatDistanceToNow } from "date-fns";
import { createServiceClient } from "@/lib/db/client";
import { loadAiVisibilityData } from "@/lib/ai-visibility/engine";
import { queryLocalTrustOpportunities } from "@/lib/local-trust/engine";
import {
  MOCKUP_GROUP_LABELS,
  OPPORTUNITY_TYPE_LABELS,
  type OpportunityDisplayGroup,
  type OpportunityType,
} from "@/lib/local-trust/types";
import { loadLatestMomentumRun } from "@/lib/reviews/momentum-engine";
import { buildMarketInsightsFromEntityRows } from "@/lib/reviews/market-insights";
import { hasOwnerResponse } from "@/lib/reviews/normalize";
import {
  REVIEW_LIST_COLUMNS,
  calcResponseRate,
  loadStoredReviews,
  reviewsInWindow,
  type StoredReviewRow,
} from "@/lib/reviews/review-store";
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

function mapStoredReview(row: StoredReviewRow): DashboardLatestReview {
  const relativeDate = row.review_date
    ? formatDistanceToNow(new Date(row.review_date), { addSuffix: true })
    : row.relative_date_text;

  return {
    reviewerName: row.reviewer_name ?? "Customer",
    rating: row.rating != null ? Number(row.rating) : null,
    reviewText: (row.review_text ?? "").trim(),
    relativeDate,
    replied: hasOwnerResponse(row.owner_response_text),
  };
}

async function loadLatestDashboardReviews(
  businessId: string,
  limit = 2
): Promise<DashboardLatestReview[]> {
  const supabase = createServiceClient();
  const stored = await loadStoredReviews(supabase, { businessId, lookbackDays: 365, limit: 12 });
  const byId = new Map<string, StoredReviewRow>();
  for (const row of stored) byId.set(row.id, row);

  if (byId.size < limit) {
    const { data: extra } = await supabase
      .from("business_reviews")
      .select(REVIEW_LIST_COLUMNS)
      .eq("business_id", businessId)
      .not("review_text", "is", null)
      .order("created_at", { ascending: false })
      .limit(12);

    for (const row of extra ?? []) {
      if (!byId.has(row.id as string)) byId.set(row.id as string, row as StoredReviewRow);
    }
  }

  return [...byId.values()]
    .filter((row) => (row.review_text ?? "").trim())
    .sort((a, b) => {
      const da = a.review_date
        ? new Date(a.review_date).getTime()
        : new Date(a.created_at).getTime();
      const db = b.review_date
        ? new Date(b.review_date).getTime()
        : new Date(b.created_at).getTime();
      return db - da;
    })
    .slice(0, limit)
    .map(mapStoredReview);
}

function opportunityTypeLabel(row: Record<string, unknown>): string {
  const raw = row.raw_json as Record<string, unknown> | undefined;
  const displayGroup = raw?.displayGroup as string | undefined;
  if (displayGroup) {
    return (
      MOCKUP_GROUP_LABELS[displayGroup as OpportunityDisplayGroup] ??
      formatOpportunityType(displayGroup)
    );
  }
  const type = String(row.opportunity_type ?? "");
  return OPPORTUNITY_TYPE_LABELS[type as OpportunityType] ?? formatOpportunityType(type);
}

function suggestedActionForRow(row: Record<string, unknown>): string | null {
  const raw = row.raw_json as Record<string, unknown> | undefined;
  const verification = raw?.verification as Record<string, unknown> | undefined;
  const action = verification?.nextAction ?? row.suggested_action;
  if (action == null || action === "") return null;
  return String(action);
}

export async function loadDashboardFeatured(businessId: string): Promise<DashboardFeaturedData> {
  const supabase = createServiceClient();

  const { data: biz } = await supabase
    .from("businesses")
    .select("organization_id")
    .eq("id", businessId)
    .maybeSingle();
  const organizationId = (biz?.organization_id as string | undefined) ?? null;

  // Prefer feature_business_summaries when present; fall back to live engines.
  const { getFeatureSummary } = await import("@/lib/platform/summaries");
  const [aiSummary, momentumSummary, localSummary, reputationSummary] = organizationId
    ? await Promise.all([
        getFeatureSummary({ organizationId, businessId, feature: "ai_visibility" }),
        getFeatureSummary({ organizationId, businessId, feature: "review_momentum" }),
        getFeatureSummary({ organizationId, businessId, feature: "local_trust" }),
        getFeatureSummary({ organizationId, businessId, feature: "reputation" }),
      ])
    : [null, null, null, null];

  const [reputation, momentum, aiData, localResult, latestReviews, targetRows] = await Promise.all([
    loadLatestReputationAudit(businessId).catch(() => null),
    loadLatestMomentumRun(businessId).catch(() => null),
    loadAiVisibilityData(businessId).catch(() => null),
    queryLocalTrustOpportunities({ businessId, page: 1, pageSize: 4 }).catch(() => ({
      items: [] as Awaited<ReturnType<typeof queryLocalTrustOpportunities>>["items"],
      total: 0,
    })),
    loadLatestDashboardReviews(businessId, 2),
    loadStoredReviews(supabase, { businessId, lookbackDays: 365 }),
  ]);

  // Summary overlay markers (used below when live rows are empty).
  const summaryAiRun = (aiSummary?.summary?.latestRun ?? null) as {
    status?: string;
    finished_at?: string | null;
    created_at?: string | null;
    target_mentioned?: boolean;
    visibility_score?: number | null;
  } | null;
  const summaryLocalRun = (localSummary?.summary?.latestRun ?? null) as {
    opportunities_found?: number | null;
  } | null;
  void momentumSummary;
  void reputationSummary;

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

  const target90 = reviewsInWindow(targetRows, 90);
  const storedResponseRate = target90.length ? calcResponseRate(target90) : null;

  const review: DashboardReviewPerformance = {
    rating:
      reputation?.audit?.rating != null
        ? Number(reputation.audit.rating)
        : target?.rating_current != null
          ? Number(target.rating_current)
          : null,
    totalReviews:
      (reputation?.audit?.total_reviews as number | undefined) ??
      target?.total_reviews_current ??
      targetRows.length,
    newReviews90d:
      target90.length > 0
        ? target90.length
        : (reputation?.audit?.reviews_90d as number | undefined) ??
          (target?.reviews_90d as number | undefined) ??
          0,
    responseRate:
      storedResponseRate ??
      (reputation?.audit?.response_rate != null
        ? Math.round(Number(reputation.audit.response_rate))
        : null),
    momentumLabel: (target?.momentum_label as MomentumLabel | null) ?? null,
    weeklyPaceGap: market?.weeklyPaceGap ?? null,
    yourSharePct: yourShare,
    top3SharePct,
    trend,
    latestReviews,
    topCompetitor: topMomentumCompetitor
      ? {
          name: topMomentumCompetitor.name,
          reviews30d: topMomentumCompetitor.reviews_30d ?? 0,
          rating:
            topMomentumCompetitor.rating != null ? Number(topMomentumCompetitor.rating) : null,
        }
      : null,
    hasData: Boolean(reputation?.audit || target || targetRows.length > 0),
  };

  const engineMentioned = new Map<AiEngine, boolean>();
  if (aiData?.engineResults) {
    for (const er of aiData.engineResults as unknown as Array<{
      engine: AiEngine;
      target_mentioned?: boolean;
    }>) {
      if (er.target_mentioned) engineMentioned.set(er.engine, true);
    }
  }

  const latestRun = aiData?.runs?.find((r) => r.status === "complete") ?? null;

  const aiFromSummary =
    !latestRun && summaryAiRun && String(summaryAiRun.status ?? "") === "complete"
      ? summaryAiRun
      : null;

  const ai: DashboardAiVisibility = {
    hasData: Boolean(latestRun || aiFromSummary),
    visibilityScore:
      latestRun?.visibility_score ?? aiFromSummary?.visibility_score ?? null,
    lastRunAt:
      latestRun?.finished_at ??
      latestRun?.created_at ??
      aiFromSummary?.finished_at ??
      aiFromSummary?.created_at ??
      null,
    targetMentioned: Boolean(
      latestRun?.target_mentioned ?? aiFromSummary?.target_mentioned
    ),
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

  const localItems: DashboardLocalOpportunity[] = (localResult.items ?? []).map((o) => ({
    id: o.id as string,
    title: o.title as string,
    opportunityType: opportunityTypeLabel(o as Record<string, unknown>),
    priority: (o.priority as string) ?? "medium",
    suggestedAction: suggestedActionForRow(o as Record<string, unknown>),
    evidenceSnippet: (o.evidence_snippet as string | null) ?? null,
    domain: (o.domain as string | null) ?? null,
  }));

  const localHasData =
    localItems.length > 0 || Number(summaryLocalRun?.opportunities_found ?? 0) > 0;

  return {
    review,
    ai,
    local: {
      hasData: localHasData,
      items: localItems,
      total:
        localResult.total ??
        (localItems.length || Number(summaryLocalRun?.opportunities_found ?? 0)),
    },
  };
}
