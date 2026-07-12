import { createServiceClient } from "@/lib/db/client";
import { runCitationAudit } from "@/lib/citations/engine";
import { runReputationAudit } from "@/lib/reputation/engine";
import { runBacklinkGap } from "@/lib/backlink-gap/engine";
import { loadKeywordTrackerOverview } from "@/lib/keyword-tracker/engine";
import { loadBacklinkGapSummaryForAudit } from "@/lib/growth-audit/backlink-summary";
import type { ExtendedModuleStatus, GrowthAuditSections } from "@/lib/growth-audit/types";

export async function runExtendedModulesInBackground(params: {
  growthRunId: string;
  businessId: string;
  organizationId: string;
}): Promise<void> {
  const supabase = createServiceClient();
  const extended: ExtendedModuleStatus = {};

  try {
    await supabase
      .from("growth_audit_runs")
      .update({ status: "extended_running", progress_stage: "Running extended modules" })
      .eq("id", params.growthRunId);

    const tasks: Array<Promise<void>> = [];

    tasks.push(
      runCitationAudit({
        businessId: params.businessId,
        organizationId: params.organizationId,
        forceRefresh: true,
      })
        .then((r) => {
          extended.citations = { auditId: r.auditId, status: "complete", score: r.score };
        })
        .catch(() => {
          extended.citations = { auditId: "", status: "failed" };
        })
    );

    tasks.push(
      runReputationAudit({
        businessId: params.businessId,
        organizationId: params.organizationId,
      })
        .then((r) => {
          extended.reputation = { auditId: r.auditId, status: r.status, score: r.score };
        })
        .catch(() => {
          extended.reputation = { auditId: "", status: "failed" };
        })
    );

    tasks.push(
      runBacklinkGap({
        businessId: params.businessId,
        organizationId: params.organizationId,
      })
        .then(async (r) => {
          const summary = await loadBacklinkGapSummaryForAudit(params.businessId);
          extended.backlinkGap = { runId: r.runId, status: "complete", summary };
          await patchCompetitorGapBacklinks(params.growthRunId, summary);
        })
        .catch(() => {
          extended.backlinkGap = { runId: "", status: "failed" };
        })
    );

    tasks.push(
      loadKeywordTrackerOverview(params.businessId)
        .then((summary) => {
          extended.keywords = {
            status: summary ? "complete" : "empty",
            summary: summary as unknown as Record<string, unknown>,
          };
        })
        .catch(() => {
          extended.keywords = { status: "failed", summary: null };
        })
    );

    await Promise.allSettled(tasks);

    await supabase
      .from("growth_audit_runs")
      .update({
        status: "complete",
        extended_json: extended,
        progress_stage: null,
        finished_at: new Date().toISOString(),
      })
      .eq("id", params.growthRunId);
  } catch (err) {
    await supabase
      .from("growth_audit_runs")
      .update({
        status: "failed",
        error_message: err instanceof Error ? err.message : "Extended modules failed",
        extended_json: extended,
        finished_at: new Date().toISOString(),
      })
      .eq("id", params.growthRunId);
  }
}

async function patchCompetitorGapBacklinks(
  growthRunId: string,
  summary: Awaited<ReturnType<typeof loadBacklinkGapSummaryForAudit>>
) {
  if (!summary?.available) return;
  const supabase = createServiceClient();
  const { data: run } = await supabase
    .from("growth_audit_runs")
    .select("sections_json")
    .eq("id", growthRunId)
    .maybeSingle();

  if (!run?.sections_json) return;

  const sections = run.sections_json as GrowthAuditSections;
  const gap = sections.competitorGap?.result;
  if (!gap) return;

  gap.backlinkGap = summary;
  if (gap.metrics) {
    gap.metrics.referringDomains = {
      you: summary.yourReferringDomains,
      competitorTotal: summary.competitorReferringDomains,
    };
  }

  if (summary.competitorReferringDomains > summary.yourReferringDomains * 1.3) {
    const msg = `Competitors have more referring domains (${summary.competitorReferringDomains} vs your ${summary.yourReferringDomains}).`;
    if (!gap.whyTheyBeatYou.includes(msg)) gap.whyTheyBeatYou.push(msg);
    const task = `Review ${summary.missingOpportunities} backlink gap opportunities (${summary.highPriorityCount} high priority)`;
    if (!gap.yourGaps.includes(task)) gap.yourGaps.push(task);
  }

  await supabase
    .from("growth_audit_runs")
    .update({ sections_json: sections })
    .eq("id", growthRunId);
}
