import type { ActionTask, AuditCheck, GbpProfile } from "@/lib/audit/types";
import type { CategoryGapResult } from "@/lib/audit/category-gap";
import type { Core30Result } from "@/lib/audit/core30";
import type { CompetitorGapResult } from "@/lib/audit/competitor-gap";
import type { HyperLocalOpportunity } from "@/lib/audit/hyperlocal";
import type { ServiceCoverageAuditResult } from "@/lib/audit/service-coverage";

function task(
  partial: Omit<ActionTask, "timeframe"> & { timeframe?: ActionTask["timeframe"] }
): ActionTask {
  return { timeframe: "7-day", ...partial };
}

export function buildActionPlanFromAudits(input: {
  gbp: GbpProfile;
  websiteChecks?: AuditCheck[];
  categoryGap?: CategoryGapResult;
  core30?: Core30Result;
  hyperlocal?: HyperLocalOpportunity[];
  competitorGap?: CompetitorGapResult;
  serviceKeywords?: ServiceCoverageAuditResult;
}): {
  urgent: ActionTask[];
  sevenDay: ActionTask[];
  thirtyDay: ActionTask[];
  all: ActionTask[];
} {
  const tasks: ActionTask[] = [];

  for (const check of input.websiteChecks ?? []) {
    if (check.status === "match") continue;
    tasks.push(
      task({
        title: `Fix: ${check.label}`,
        description: check.websiteValue ? `Current: ${check.websiteValue}` : "Not found on website",
        why: check.whyItMatters ?? check.label,
        impact: check.status === "mismatch" ? "high" : "medium",
        effort: "medium",
        bucket: check.bucket,
        evidence: check.gbpValue ? `GBP: ${check.gbpValue}` : check.evidence,
        module: "website-match",
        timeframe: check.status === "mismatch" ? "urgent" : "7-day",
      })
    );
  }

  for (const rec of input.categoryGap?.categoryAlignment?.recommendations.slice(0, 3) ?? []) {
    tasks.push(
      task({
        title: `Review GBP category: ${rec.category}`,
        description: rec.recommendationText,
        why: rec.notes,
        impact: rec.confidence === "high" ? "high" : "medium",
        effort: "low",
        bucket: "relevance",
        module: "category-gap",
        timeframe: rec.confidence === "high" ? "7-day" : "30-day",
      })
    );
  }

  for (const sk of input.serviceKeywords?.rows.filter((r) => r.opportunity === "high" && !r.onYourWebsite).slice(0, 4) ?? []) {
    tasks.push(
      task({
        title: `Add service coverage: ${sk.service}`,
        description: sk.note,
        why: `${sk.competitorTop20Count}/${sk.totalCompetitors} competitors mention this in Maps results`,
        impact: "high",
        effort: "medium",
        bucket: "relevance",
        module: "service-coverage",
        timeframe: "7-day",
      })
    );
  }

  for (const mp of input.categoryGap?.missingPages.slice(0, 5) ?? []) {
    tasks.push(
      task({
        title: `Create page: ${mp.service}`,
        description: `Suggested title: "${mp.suggestedTitle}"`,
        why: mp.reason,
        impact: "high",
        effort: "medium",
        bucket: "relevance",
        module: "category-gap",
        timeframe: "7-day",
      })
    );
  }

  for (const mp of input.core30?.missingPages.slice(0, 5) ?? []) {
    tasks.push(
      task({
        title: `Core 30: Add ${mp.name} page`,
        description: `Title: "${mp.suggestedTitle}"`,
        why: "GBP lists this service but site has no matching page",
        impact: "high",
        effort: "medium",
        bucket: "relevance",
        module: "core30",
      })
    );
  }

  for (const wp of input.core30?.weakPages.slice(0, 3) ?? []) {
    tasks.push(
      task({
        title: `Expand thin page: ${wp.url}`,
        description: wp.issue,
        why: "Thin service pages limit relevance and conversion",
        impact: "medium",
        effort: "low",
        bucket: "prominence",
        module: "core30",
      })
    );
  }

  for (const h of (input.hyperlocal ?? []).filter((o) => o.status === "missing").slice(0, 4)) {
    tasks.push(
      task({
        title: `Build hyper-local page: ${h.neighborhood}`,
        description: `H1: "${h.suggestedH1}" — include landmarks, local FAQ, internal links`,
        why: "Hyper-local neighborhood pages are a fast Maps lever per SOP",
        impact: "high",
        effort: "medium",
        bucket: "relevance",
        module: "hyperlocal",
        timeframe: "30-day",
      })
    );
  }

  for (const gap of input.competitorGap?.yourGaps ?? []) {
    tasks.push(
      task({
        title: gap,
        description: input.competitorGap?.whyTheyBeatYou[0] ?? "Competitor gap identified",
        why: "Closes competitive visibility gap",
        impact: "high",
        effort: "medium",
        bucket: "prominence",
        module: "competitor-gaps",
      })
    );
  }

  if (!input.gbp.hoursText) {
    tasks.push(
      task({
        title: "Complete GBP hours",
        description: "Add accurate business hours to Google Business Profile",
        why: "Missing hours reduces trust and filter visibility",
        impact: "medium",
        effort: "low",
        bucket: "trust",
        module: "gbp-audit",
        timeframe: "urgent",
      })
    );
  }

  const urgent = tasks.filter((t) => t.timeframe === "urgent").slice(0, 3);
  const sevenDay = tasks.filter((t) => t.timeframe === "7-day").slice(0, 7);
  const thirtyDay = tasks.filter((t) => t.timeframe === "30-day").slice(0, 10);

  return { urgent, sevenDay, thirtyDay, all: tasks };
}
