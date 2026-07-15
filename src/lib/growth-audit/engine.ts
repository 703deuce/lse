import { createServiceClient } from "@/lib/db/client";
import { runWebsiteMatchAudit } from "@/lib/audit/website-match";
import { runCategoryGapAudit } from "@/lib/audit/category-gap";
import { runCore30Audit } from "@/lib/audit/core30";
import { runHyperLocalAudit } from "@/lib/audit/hyperlocal";
import { runCompetitorGapAudit } from "@/lib/audit/competitor-gap";
import { runReviewAudit, runPostAudit, runPhotoAudit } from "@/lib/audit/gbp-modules";
import { loadGrowthAuditContext } from "@/lib/growth-audit/context";
import { buildGbpSection } from "@/lib/growth-audit/sections/gbp";
import { buildWebsiteSection } from "@/lib/growth-audit/sections/website-match";
import { buildServiceCoverageSection } from "@/lib/growth-audit/sections/service-coverage";
import { buildLocalCoverageSection } from "@/lib/growth-audit/sections/local-coverage";
import { buildCompetitorGapSection } from "@/lib/growth-audit/sections/competitor-gap";
import { buildGrowthPlanSection } from "@/lib/growth-audit/sections/growth-plan";
import { buildOverviewSection } from "@/lib/growth-audit/sections/overview";
import { computeGrowthScore, deriveStrengthsWeaknesses } from "@/lib/growth-audit/score";
import { generateGrowthAuditSummary } from "@/lib/growth-audit/ai-summary";
import { runServiceCoverageAudit } from "@/lib/audit/service-coverage";
import type { GrowthAuditRunRow, GrowthAuditSections, GrowthTask } from "@/lib/growth-audit/types";
import { dispatchFeatureJob } from "@/lib/queue/dispatch";

export type RunGrowthAuditResult = {
  runId: string;
  status: string;
  growthScore: number;
  sections: GrowthAuditSections;
  growthPlan: GrowthTask[];
};

export async function runGrowthAudit(params: {
  businessId: string;
  organizationId: string;
  keyword?: string;
  skipBackground?: boolean;
}): Promise<RunGrowthAuditResult> {
  const supabase = createServiceClient();
  const ctx = await loadGrowthAuditContext(params.businessId, params.organizationId, params.keyword);

  const { data: runRow, error: insertErr } = await supabase
    .from("growth_audit_runs")
    .insert({
      organization_id: params.organizationId,
      business_id: params.businessId,
      status: "running",
      scan_batch_id: ctx.scanBatchId,
      progress_stage: "Analyzing Google Maps presence",
    })
    .select("id")
    .single();

  if (insertErr || !runRow) throw new Error(insertErr?.message ?? "Failed to create audit run");
  const runId = runRow.id as string;

  try {
    const competitorPhotoAvg =
      ctx.competitors.length > 0
        ? ctx.competitors.reduce((s, c) => s + (c.photoCount ?? 0), 0) / ctx.competitors.length
        : undefined;

    const website = ctx.gbp.website
      ? await runWebsiteMatchAudit(ctx.gbp, ctx.keyword)
      : { checks: [], score: 0, pages: [] };

    const [categoryGap, core30, hyperlocal, reviews, posts, photos, serviceKeywords] =
      await Promise.all([
      runCategoryGapAudit(ctx.gbp, ctx.competitorCategories, {
        pages: ctx.pages,
        competitors: ctx.competitors,
      }),
      runCore30Audit(ctx.gbp, { pages: ctx.pages }),
      runHyperLocalAudit(ctx.gbp, ctx.serviceAreas.map((a) => a.name), {
        pages: ctx.pages,
        areas: ctx.serviceAreas.map((a) => a.name),
        competitors: ctx.competitors,
      }),
      runReviewAudit(ctx.gbp, params.businessId),
      runPostAudit(ctx.gbp, params.businessId),
      runPhotoAudit(ctx.gbp, params.businessId, competitorPhotoAvg),
      Promise.resolve(runServiceCoverageAudit(ctx.gbp, ctx.competitors, ctx.pages)),
    ]);

    const competitorGap = await runCompetitorGapAudit(ctx.gbp, ctx.competitors, {
      core30,
      websiteChecks: website.checks,
      categoryAlignment: categoryGap.categoryAlignment,
      backlinkGap: ctx.backlinkGap,
    });

    const gbpSection = buildGbpSection({
      gbp: ctx.gbp,
      reviews,
      posts,
      photos,
      categoryAlignment: categoryGap.categoryAlignment,
    });
    const websiteSection = buildWebsiteSection(website.checks, website.score);
    const serviceCoverage = buildServiceCoverageSection(categoryGap, core30, serviceKeywords);
    const localCoverage = buildLocalCoverageSection(ctx.gbp, hyperlocal, ctx.serviceAreas, ctx.competitors);
    const competitorGapSection = buildCompetitorGapSection(competitorGap);
    const growthPlan = buildGrowthPlanSection({
      gbp: ctx.gbp,
      websiteChecks: website.checks,
      categoryGap,
      core30,
      hyperlocal: hyperlocal.opportunities,
      competitorGap,
      serviceKeywords,
    });

    const partialForOverview = {
      gbp: gbpSection,
      website: websiteSection,
      serviceCoverage,
      localCoverage,
      competitorGap: competitorGapSection,
      growthPlan,
    };

    const growthScore = computeGrowthScore({
      gbpScore: gbpSection.score,
      websiteScore: websiteSection.score,
      serviceScore: serviceCoverage.score,
      localScore: localCoverage.score,
      competitorScore: competitorGapSection.score,
      scanOverall: ctx.scanAuditScores?.overall,
    });

    const { strengths, weaknesses, immediateFixes } = deriveStrengthsWeaknesses({
      overview: {
        growthScore,
        strengths: [],
        weaknesses: [],
        immediateFixes: [],
        aiSummary: null,
        scanScores: ctx.scanAuditScores,
        hasScan: Boolean(ctx.scanBatchId),
      },
      ...partialForOverview,
    });

    const aiSummary = await generateGrowthAuditSummary({
      businessName: ctx.gbp.name,
      keyword: ctx.keyword,
      growthScore,
      strengths,
      weaknesses,
      topTasks: growthPlan.urgent.map((t) => t.title),
      organizationId: params.organizationId,
    });

    const overview = buildOverviewSection(
      partialForOverview,
      aiSummary,
      ctx.scanAuditScores,
      Boolean(ctx.scanBatchId)
    );
    overview.strengths = strengths;
    overview.weaknesses = weaknesses;
    overview.immediateFixes = immediateFixes;

    const sections: GrowthAuditSections = { overview, ...partialForOverview };

    const { error: updateError } = await supabase
      .from("growth_audit_runs")
      .update({
        status: "core_ready",
        growth_score: overview.growthScore,
        sections_json: sections,
        growth_plan_json: growthPlan.tasks,
        progress_stage: params.skipBackground ? null : "Starting extended modules",
      })
      .eq("id", runId);

    if (updateError) throw new Error(updateError.message);

    if (!params.skipBackground) {
      const extended = await dispatchFeatureJob({
        jobType: "growth_audit_extended",
        payload: {
          growthRunId: runId,
          businessId: params.businessId,
          organizationId: params.organizationId,
        },
        organizationId: params.organizationId,
        businessId: params.businessId,
        idempotencyKey: `growth-extended:${runId}`,
        priority: "normal",
        maxAttempts: 2,
      });
      if (extended.enqueueState === "enqueue_failed") {
        await supabase
          .from("growth_audit_runs")
          .update({
            status: "failed",
            error_message: "Extended modules could not be queued — retry the audit",
            finished_at: new Date().toISOString(),
            progress_stage: null,
          })
          .eq("id", runId);
        return {
          runId,
          status: "failed",
          growthScore: overview.growthScore,
          sections,
          growthPlan: growthPlan.tasks,
        };
      }
    }

    return {
      runId,
      status: "core_ready",
      growthScore: overview.growthScore,
      sections,
      growthPlan: growthPlan.tasks,
    };
  } catch (err) {
    await supabase
      .from("growth_audit_runs")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "Audit failed",
        finished_at: new Date().toISOString(),
      })
      .eq("id", runId);
    throw err;
  }
}

export async function loadLatestGrowthAudit(businessId: string): Promise<GrowthAuditRunRow | null> {
  const supabase = createServiceClient();
  // Prefer newest usable audit (has sections). A failed/blank latest must not hide prior good runs.
  const { data: usable } = await supabase
    .from("growth_audit_runs")
    .select("*")
    .eq("business_id", businessId)
    .not("sections_json", "is", null)
    .neq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (usable) return usable as GrowthAuditRunRow;

  const { data } = await supabase
    .from("growth_audit_runs")
    .select("*")
    .eq("business_id", businessId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return (data as GrowthAuditRunRow) ?? null;
}
