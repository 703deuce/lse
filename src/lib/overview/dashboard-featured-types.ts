import type { AiEngine } from "@/lib/ai-visibility/types";
import type { MomentumLabel } from "@/lib/reviews/metrics";

export type DashboardLatestReview = {
  reviewerName: string;
  rating: number | null;
  reviewText: string;
  relativeDate: string | null;
  replied: boolean;
};

export type DashboardTopCompetitor = {
  name: string;
  reviews30d: number;
  rating: number | null;
};

export type DashboardReviewPerformance = {
  rating: number | null;
  totalReviews: number;
  newReviews90d: number;
  responseRate: number | null;
  momentumLabel: MomentumLabel | null;
  weeklyPaceGap: number | null;
  yourSharePct: number;
  top3SharePct: number;
  trend: number[];
  latestReview: DashboardLatestReview | null;
  topCompetitor: DashboardTopCompetitor | null;
  hasData: boolean;
};

export type DashboardAiMention = {
  name: string;
  sharePct: number;
  engineCount: number;
  isTarget: boolean;
};

export type DashboardAiVisibility = {
  hasData: boolean;
  visibilityScore: number | null;
  lastRunAt: string | null;
  targetMentioned: boolean;
  engines: Array<{ engine: AiEngine; label: string; mentioned: boolean }>;
  mentions: DashboardAiMention[];
  companyCount: number;
  primaryPrompt: string | null;
};

export type DashboardLocalOpportunity = {
  id: string;
  title: string;
  opportunityType: string;
  priority: string;
  suggestedAction: string | null;
  evidenceSnippet: string | null;
  domain: string | null;
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

export function formatOpportunityType(type: string): string {
  return type
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function priorityClass(priority: string): string {
  if (priority === "high") return "bg-emerald-50 text-emerald-700";
  if (priority === "medium") return "bg-amber-50 text-amber-700";
  return "bg-zinc-100 text-zinc-600";
}
