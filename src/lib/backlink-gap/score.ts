import { rankToPower } from "@/lib/backlink-gap/power";
import type { SourceType } from "@/lib/backlink-gap/classify";

export type Priority = "high" | "medium" | "low" | "ignore";

export function scoreToPriority(score: number): Priority {
  if (score >= 80) return "high";
  if (score >= 50) return "medium";
  if (score >= 20) return "low";
  return "ignore";
}

export function scoreOpportunity(params: {
  competitorCount: number;
  totalCompetitors: number;
  domainRank: number | null;
  sourceType: SourceType;
  dofollow: boolean | null;
  firstSeen: string | null;
  isSpam: boolean;
  localFit?: boolean;
  industryFit?: boolean;
}): { score: number; priority: Priority; suggestedAction: string; reason: string } {
  if (params.isSpam) {
    return {
      score: 0,
      priority: "ignore",
      suggestedAction: "Ignore — likely spam or low-quality link source",
      reason: "Domain matches spam/junk patterns or high spam score.",
    };
  }

  const total = Math.max(params.totalCompetitors, 1);
  const compRatio = Math.min(params.competitorCount / total, 1);
  let compScore = compRatio * 100;
  if (params.competitorCount >= 2) compScore = Math.min(100, compScore + 15);

  const rank = params.domainRank ?? 0;
  const authorityScore = rank > 0 ? Math.min(100, (rank / 1000) * 100) : 25;

  let relevanceScore = 40;
  if (params.localFit) relevanceScore += 35;
  if (params.industryFit) relevanceScore += 25;
  if (["Local website", "Industry website", "Supplier / manufacturer"].includes(params.sourceType)) {
    relevanceScore += 20;
  }
  if (params.sourceType === "Citation / Directory") relevanceScore += 10;
  relevanceScore = Math.min(100, relevanceScore);

  let typeScore = 50;
  const actionable: Record<string, number> = {
    "Citation / Directory": 85,
    "Local website": 90,
    "Industry website": 85,
    "Supplier / manufacturer": 80,
    "Sponsorship / community": 75,
    "Guest article": 70,
    "News / PR": 75,
    "Blog mention": 60,
    "Social/profile": 55,
    Unknown: 35,
    "Spam / Ignore": 0,
  };
  typeScore = actionable[params.sourceType] ?? 35;

  let linkScore = 60;
  if (params.dofollow === true) linkScore += 25;
  if (params.dofollow === false) linkScore -= 20;
  if (params.firstSeen) {
    const year = new Date(params.firstSeen).getFullYear();
    if (year >= new Date().getFullYear() - 2) linkScore += 15;
  }
  linkScore = Math.max(0, Math.min(100, linkScore));

  let score =
    compScore * 0.35 +
    authorityScore * 0.25 +
    relevanceScore * 0.2 +
    typeScore * 0.1 +
    linkScore * 0.1;

  if (params.competitorCount >= 2) score += 5;
  if (["Local website", "News / PR", "Supplier / manufacturer"].includes(params.sourceType)) score += 5;
  if (params.dofollow === false && params.competitorCount === 1) score -= 10;
  if (params.sourceType === "Unknown") score -= 5;

  score = Math.round(Math.max(0, Math.min(100, score)));
  const priority = scoreToPriority(score);

  const suggestedAction = suggestAction(params.sourceType, priority);
  const reason = buildReason(params);

  return { score, priority, suggestedAction, reason };
}

function suggestAction(type: SourceType, priority: Priority): string {
  if (priority === "ignore") return "No action — deprioritize or ignore";
  const actions: Record<string, string> = {
    "Citation / Directory": "Claim or create a complete business listing with NAP and website link",
    "Local website": "Reach out for a local partnership, sponsorship, or directory inclusion",
    "Industry website": "Request inclusion in industry directory or partner page",
    "Supplier / manufacturer": "Ask supplier for dealer/partner backlink on their locator page",
    "Sponsorship / community": "Explore sponsorship or community partnership for a mention",
    "Guest article": "Pitch a guest post or expert quote to earn an editorial link",
    "News / PR": "Submit a local news story or press release for coverage",
    "Blog mention": "Engage author or site owner for a relevant mention or resource link",
    "Social/profile": "Complete and optimize business profile with website URL",
    Unknown: "Investigate the linking page and pursue if context is relevant",
    "Spam / Ignore": "Ignore",
  };
  return actions[type] ?? actions.Unknown;
}

function buildReason(params: {
  competitorCount: number;
  sourceType: SourceType;
  domainRank: number | null;
  dofollow: boolean | null;
}): string {
  const parts: string[] = [];
  parts.push(`Links to ${params.competitorCount} competitor${params.competitorCount === 1 ? "" : "s"}`);
  parts.push(`classified as ${params.sourceType}`);
  if (params.domainRank) {
    const power = rankToPower(params.domainRank);
    if (power != null) parts.push(`link power ${power}/100`);
  }
  if (params.dofollow === true) parts.push("dofollow link");
  if (params.dofollow === false) parts.push("nofollow only");
  return parts.join("; ") + ".";
}
