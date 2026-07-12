import type { ActionTask, AuditCheck, GbpProfile } from "@/lib/audit/types";
import type { CategoryGapResult } from "@/lib/audit/category-gap";
import type { Core30Result } from "@/lib/audit/core30";
import type { CompetitorGapResult } from "@/lib/audit/competitor-gap";
import type { HyperLocalOpportunity } from "@/lib/audit/hyperlocal";
import type { CategoryAlignmentResult } from "@/lib/audit/category-alignment";
import type { ServiceCoverageAuditResult } from "@/lib/audit/service-coverage";
import type { BacklinkGapSummary } from "@/lib/growth-audit/backlink-summary";
import type { ReviewAuditResult, PostAuditResult, PhotoAuditResult } from "@/lib/audit/gbp-modules";

export type GrowthAuditStatus = "running" | "core_ready" | "extended_running" | "complete" | "failed";

export type GrowthTask = ActionTask & {
  priority: "high" | "medium" | "low";
  impactStars: number;
  difficulty: "easy" | "medium" | "hard";
  timeEstimate: string;
  sourceSection: string;
};

export type ServiceCoverageRow = {
  service: string;
  gbpListed: boolean;
  pageExists: boolean;
  pageUrl?: string;
  score?: number;
  status: "excellent" | "weak" | "missing";
  competitorNote?: string;
  onYourGbp?: boolean;
  competitorTop20Count?: number;
  opportunity?: "high" | "medium" | "low";
};

export type LocalCoverageRow = {
  area: string;
  type: "neighborhood" | "city" | "location";
  hasPage: boolean;
  mentionedOnSite?: boolean;
  competitorCount: number;
  opportunity: "high" | "medium" | "low";
  status: "excellent" | "needs_improvement" | "missing";
};

export type OverviewSection = {
  growthScore: number;
  strengths: string[];
  weaknesses: string[];
  immediateFixes: string[];
  aiSummary: string | null;
  scanScores?: {
    relevance: number;
    distance: number;
    prominence: number;
    trust: number;
    overall: number;
  } | null;
  hasScan: boolean;
};

export type GbpSection = {
  score: number;
  profile: GbpProfile;
  checks: AuditCheck[];
  reviews: ReviewAuditResult;
  posts: PostAuditResult;
  photos: PhotoAuditResult;
  categoryAlignment: CategoryAlignmentResult | null;
};

export type WebsiteMatchSection = {
  score: number;
  checks: AuditCheck[];
};

export type ServiceCoverageSection = {
  score: number;
  rows: ServiceCoverageRow[];
  categoryGap: CategoryGapResult;
  core30: Core30Result;
  serviceKeywords?: ServiceCoverageAuditResult;
};

export type LocalCoverageSection = {
  score: number;
  neighborhoods: LocalCoverageRow[];
  cities: LocalCoverageRow[];
  opportunities: HyperLocalOpportunity[];
};

export type CompetitorGapSection = {
  score: number;
  result: CompetitorGapResult;
};

export type GrowthPlanSection = {
  tasks: GrowthTask[];
  urgent: GrowthTask[];
  sevenDay: GrowthTask[];
  thirtyDay: GrowthTask[];
};

export type ExtendedModuleStatus = {
  citations?: { auditId: string; status: string; score?: number | null };
  reputation?: { auditId: string; status: string; score?: number | null };
  backlinkGap?: { runId: string; status: string; summary?: BacklinkGapSummary | null };
  keywords?: { summary: Record<string, unknown> | null; status: string };
};

export type GrowthAuditSections = {
  overview: OverviewSection;
  gbp: GbpSection;
  website: WebsiteMatchSection;
  serviceCoverage: ServiceCoverageSection;
  localCoverage: LocalCoverageSection;
  competitorGap: CompetitorGapSection;
  growthPlan: GrowthPlanSection;
};

export type GrowthAuditRunRow = {
  id: string;
  organization_id: string;
  business_id: string;
  status: GrowthAuditStatus;
  growth_score: number | null;
  scan_batch_id: string | null;
  sections_json: GrowthAuditSections;
  growth_plan_json: GrowthTask[];
  extended_json: ExtendedModuleStatus & Record<string, unknown>;
  progress_stage: string | null;
  error_message: string | null;
  started_at: string;
  finished_at: string | null;
  created_at: string;
};

export type CoreModuleResults = {
  gbp: GbpProfile;
  website: { checks: AuditCheck[]; score: number; pages: unknown[] };
  categoryGap: CategoryGapResult;
  core30: Core30Result;
  hyperlocal: { opportunities: HyperLocalOpportunity[]; score: number };
  competitorGap: CompetitorGapResult;
  reviews: ReviewAuditResult;
  posts: PostAuditResult;
  photos: PhotoAuditResult;
  scanScores: OverviewSection["scanScores"];
  hasScan: boolean;
};
