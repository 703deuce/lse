import type { GrowthAuditSections } from "@/lib/growth-audit/types";

const WEIGHTS = {
  gbp: 0.2,
  website: 0.15,
  serviceCoverage: 0.2,
  localCoverage: 0.15,
  competitorGap: 0.15,
  scan: 0.15,
};

export function computeGrowthScore(sections: {
  gbpScore: number;
  websiteScore: number;
  serviceScore: number;
  localScore: number;
  competitorScore: number;
  scanOverall?: number | null;
}): number {
  const scanPart = sections.scanOverall ?? Math.round(
    (sections.gbpScore + sections.websiteScore + sections.serviceScore) / 3
  );
  const score =
    sections.gbpScore * WEIGHTS.gbp +
    sections.websiteScore * WEIGHTS.website +
    sections.serviceScore * WEIGHTS.serviceCoverage +
    sections.localScore * WEIGHTS.localCoverage +
    sections.competitorScore * WEIGHTS.competitorGap +
    scanPart * WEIGHTS.scan;
  return Math.max(0, Math.min(100, Math.round(score)));
}

export function deriveStrengthsWeaknesses(sections: GrowthAuditSections): {
  strengths: string[];
  weaknesses: string[];
  immediateFixes: string[];
} {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  const immediateFixes: string[] = [];

  if (sections.gbp.score >= 70) strengths.push("Strong Google Business Profile foundation");
  else weaknesses.push("GBP profile needs improvement");

  if (sections.website.score >= 70) strengths.push("Website aligns well with GBP");
  else weaknesses.push("Website–GBP mismatches hurting trust");

  if (sections.serviceCoverage.score >= 70) strengths.push("Good service page coverage");
  else weaknesses.push("Missing or weak service pages");

  if (sections.localCoverage.score >= 60) strengths.push("Solid local/neighborhood coverage");
  else weaknesses.push("Gaps in hyper-local landing pages");

  if ((sections.gbp.reviews.reviewCount ?? 0) >= 50) strengths.push("Healthy review volume");
  else weaknesses.push("Review count below competitive average");

  for (const t of sections.growthPlan.urgent.slice(0, 3)) {
    immediateFixes.push(t.title);
  }
  if (!immediateFixes.length) {
    for (const t of sections.growthPlan.sevenDay.slice(0, 3)) {
      immediateFixes.push(t.title);
    }
  }

  return { strengths: strengths.slice(0, 4), weaknesses: weaknesses.slice(0, 4), immediateFixes };
}
