import type { GrowthAuditSections, OverviewSection } from "@/lib/growth-audit/types";
import { computeGrowthScore, deriveStrengthsWeaknesses } from "@/lib/growth-audit/score";

export function buildOverviewSection(
  sections: Omit<GrowthAuditSections, "overview">,
  aiSummary: string | null,
  scanScores: OverviewSection["scanScores"],
  hasScan: boolean
): OverviewSection {
  const growthScore = computeGrowthScore({
    gbpScore: sections.gbp.score,
    websiteScore: sections.website.score,
    serviceScore: sections.serviceCoverage.score,
    localScore: sections.localCoverage.score,
    competitorScore: sections.competitorGap.score,
    scanOverall: scanScores?.overall,
  });

  const { strengths, weaknesses, immediateFixes } = deriveStrengthsWeaknesses({
    ...sections,
    overview: { growthScore, strengths: [], weaknesses: [], immediateFixes: [], aiSummary, scanScores, hasScan },
  } as GrowthAuditSections);

  return {
    growthScore,
    strengths,
    weaknesses,
    immediateFixes,
    aiSummary,
    scanScores,
    hasScan,
  };
}
