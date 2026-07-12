import type { OpportunityType } from "@/lib/local-trust/types";
import { difficultyForType } from "@/lib/local-trust/classify";

export function scoreOpportunity(params: {
  city: string;
  county: string | null;
  category: string;
  cityMatch: boolean;
  countyMatch: boolean;
  topicalMatch: boolean;
  competitorPresent: boolean;
  authorityScore: number;
  opportunityType: OpportunityType;
  actionabilityHint: number;
}): number {
  const localRelevance =
    (params.cityMatch ? 0.6 : 0) + (params.countyMatch ? 0.4 : 0);
  const topical = params.topicalMatch ? 1 : 0.2;
  const authority = params.authorityScore / 100;
  const actionability = params.actionabilityHint / 100;
  const competitor = params.competitorPresent ? 0.7 : 0.3;

  const score =
    localRelevance * 35 +
    topical * 20 +
    authority * 20 +
    actionability * 15 +
    competitor * 10;

  return Math.round(Math.max(0, Math.min(100, score)));
}

export function priorityFromScore(score: number): "high" | "medium" | "low" | "ignore" {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  if (score >= 20) return "low";
  return "ignore";
}

export function actionabilityScore(text: string, type: OpportunityType): number {
  let score = 50;
  const hay = text.toLowerCase();
  if (/join|member|apply|submit|register|list your|sponsor|donate|contact/i.test(hay)) score += 30;
  if (/directory|vendor|resource|partners/i.test(hay)) score += 15;
  const diff = difficultyForType(type);
  if (diff === "easy") score += 15;
  if (diff === "hard") score -= 10;
  return Math.max(0, Math.min(100, score));
}

export function matchesLocation(text: string, city: string, county: string | null): {
  cityMatch: boolean;
  countyMatch: boolean;
} {
  const hay = text.toLowerCase();
  const cityMatch = city.length > 2 && hay.includes(city.toLowerCase());
  const countyMatch = county
    ? hay.includes(county.toLowerCase().replace(/\s+county/i, "")) || hay.includes(county.toLowerCase())
    : false;
  return { cityMatch, countyMatch };
}

export function matchesTopic(text: string, category: string, keywords: string[]): boolean {
  const hay = text.toLowerCase();
  const terms = [category, ...keywords].map((k) => k.toLowerCase()).filter((k) => k.length > 3);
  return terms.some((t) => hay.includes(t));
}
