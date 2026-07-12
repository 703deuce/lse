import type { CompetitorGapResult } from "@/lib/audit/competitor-gap";
import type { CompetitorGapSection } from "@/lib/growth-audit/types";

export function buildCompetitorGapSection(result: CompetitorGapResult): CompetitorGapSection {
  const gapCount = result.yourGaps.length;
  const score = Math.max(20, 100 - gapCount * 12);
  return { score, result };
}
