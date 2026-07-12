import type { GbpProfile, LoadedCompetitor } from "@/lib/audit/types";

export type CategoryConfidence = "high" | "medium" | "low";

export type CategoryRecommendation =
  | "consider_primary"
  | "consider_secondary"
  | "keep"
  | "review"
  | "do_not_add";

export type CategoryAlignmentRow = {
  category: string;
  onYourGbp: boolean;
  isYourPrimary: boolean;
  top3Count: number;
  top10Count: number;
  top20Count: number;
  totalCompetitors: number;
  confidence: CategoryConfidence;
  recommendation: CategoryRecommendation;
  recommendationText: string;
  notes: string;
};

export type CategoryAlignmentResult = {
  currentPrimary: string | null;
  currentSecondary: string[];
  patterns: CategoryAlignmentRow[];
  recommendations: CategoryAlignmentRow[];
  reviewIdeas: CategoryAlignmentRow[];
  avoid: CategoryAlignmentRow[];
  disclaimer: string;
  competitorCount: number;
};

const DISCLAIMER =
  "Search keywords are not always Google categories. We only suggest categories observed on ranking competitors in live Maps results. Add a category only if it accurately describes your business.";

function competitorCategories(comp: LoadedCompetitor): string[] {
  return [comp.category, ...(comp.additionalCategories ?? [])].filter(Boolean) as string[];
}

function countWithCategory(
  competitors: LoadedCompetitor[],
  categoryKey: string,
  limit: number
): number {
  let count = 0;
  for (let i = 0; i < Math.min(limit, competitors.length); i++) {
    const cats = competitorCategories(competitors[i]).map((c) => c.toLowerCase());
    if (cats.includes(categoryKey)) count++;
  }
  return count;
}

function isPrimaryForCompetitor(comp: LoadedCompetitor, categoryKey: string): boolean {
  return comp.category?.toLowerCase() === categoryKey;
}

function buildRecommendationText(
  row: Omit<CategoryAlignmentRow, "recommendationText">,
  gbp: GbpProfile
): string {
  const { category, top3Count, top20Count, recommendation } = row;

  if (recommendation === "keep") {
    if (row.isYourPrimary) {
      return `You already use "${category}" as your primary category.`;
    }
    return `You already list "${category}" on your profile. Keep it if it still accurately describes your services.`;
  }

  if (recommendation === "do_not_add") {
    return `"${category}" appears on only ${top20Count} of ${row.totalCompetitors} ranking competitors. Do not add unless you genuinely offer this as a core business type.`;
  }

  if (recommendation === "review") {
    return `"${category}" appears occasionally in the top 20 (${top20Count}/${row.totalCompetitors}). Review manually — only add if it accurately represents your business.`;
  }

  if (recommendation === "consider_primary") {
    return `Top-ranking competitors commonly use "${category}" as their primary category (${top3Count}/3 in the top 3, ${top20Count}/${row.totalCompetitors} overall). If this category accurately describes your business, consider using it as your primary category.`;
  }

  return `Several competitors use "${category}" as a secondary category (${top3Count}/3 in the top 3, ${top20Count}/${row.totalCompetitors} in the top 20). Consider adding it only if it accurately represents your services.`;
}

function scoreRecommendation(
  top3Count: number,
  top10Count: number,
  top20Count: number,
  total: number,
  onYourGbp: boolean,
  isPrimaryAmongCompetitors: boolean
): { confidence: CategoryConfidence; recommendation: CategoryRecommendation; notes: string } {
  if (onYourGbp) {
    return { confidence: "high", recommendation: "keep", notes: "Already on your profile" };
  }

  if (top20Count <= 1) {
    return {
      confidence: "low",
      recommendation: "do_not_add",
      notes: "Used by only one competitor — may not be relevant to your business model",
    };
  }

  if (top3Count === 0 && top20Count <= 2) {
    return {
      confidence: "low",
      recommendation: "do_not_add",
      notes: "Rare among top competitors — avoid unless clearly accurate",
    };
  }

  if (top3Count >= 2 && top20Count >= 5) {
    return {
      confidence: "high",
      recommendation: isPrimaryAmongCompetitors ? "consider_primary" : "consider_secondary",
      notes: isPrimaryAmongCompetitors ? "Strong match — common primary among leaders" : "Strong pattern across top competitors",
    };
  }

  if (top3Count >= 1 && top20Count >= 3) {
    return {
      confidence: "medium",
      recommendation: isPrimaryAmongCompetitors ? "consider_primary" : "consider_secondary",
      notes: top3Count >= 2 ? "Used by multiple top-3 competitors" : "Present among top competitors",
    };
  }

  if (top10Count >= 2 || top20Count >= 3) {
    return {
      confidence: "medium",
      recommendation: "consider_secondary",
      notes: "Common secondary among ranking competitors",
    };
  }

  return {
    confidence: "low",
    recommendation: "review",
    notes: "Appears occasionally — verify relevance before adding",
  };
}

export function analyzeCategoryAlignment(
  gbp: GbpProfile,
  competitors: LoadedCompetitor[]
): CategoryAlignmentResult {
  const top20 = competitors.slice(0, 20);
  const total = top20.length;
  const yourPrimary = gbp.primaryCategory?.toLowerCase() ?? "";
  const yourCats = new Set(
    [gbp.primaryCategory, ...(gbp.secondaryCategories ?? [])]
      .filter(Boolean)
      .map((c) => c!.toLowerCase())
  );

  const seen = new Map<string, string>();

  for (const comp of top20) {
    for (const cat of competitorCategories(comp)) {
      const key = cat.toLowerCase().trim();
      if (key.length < 3) continue;
      if (!seen.has(key)) seen.set(key, cat);
    }
  }

  const patterns: CategoryAlignmentRow[] = [];

  for (const [key, display] of seen) {
    const top3Count = countWithCategory(top20, key, 3);
    const top10Count = countWithCategory(top20, key, 10);
    const top20Count = countWithCategory(top20, key, 20);
    const onYourGbp = yourCats.has(key);
    const isYourPrimary = yourPrimary === key;
    const isPrimaryAmongCompetitors = top20
      .slice(0, 10)
      .filter((c) => isPrimaryForCompetitor(c, key)).length >= Math.max(1, Math.ceil(top10Count / 2));

    const scored = scoreRecommendation(
      top3Count,
      top10Count,
      top20Count,
      total,
      onYourGbp,
      isPrimaryAmongCompetitors
    );

    const base = {
      category: display,
      onYourGbp,
      isYourPrimary,
      top3Count,
      top10Count,
      top20Count,
      totalCompetitors: total,
      confidence: scored.confidence,
      recommendation: scored.recommendation,
      notes: scored.notes,
    };

    patterns.push({
      ...base,
      recommendationText: buildRecommendationText(base, gbp),
    });
  }

  patterns.sort((a, b) => {
    if (a.onYourGbp !== b.onYourGbp) return a.onYourGbp ? -1 : 1;
    if (b.top20Count !== a.top20Count) return b.top20Count - a.top20Count;
    return b.top3Count - a.top3Count;
  });

  return {
    currentPrimary: gbp.primaryCategory ?? null,
    currentSecondary: gbp.secondaryCategories ?? [],
    patterns,
    recommendations: patterns.filter(
      (p) =>
        (p.confidence === "high" || p.confidence === "medium") &&
        (p.recommendation === "consider_primary" || p.recommendation === "consider_secondary")
    ),
    reviewIdeas: patterns.filter((p) => p.recommendation === "review"),
    avoid: patterns.filter((p) => p.recommendation === "do_not_add"),
    disclaimer: DISCLAIMER,
    competitorCount: total,
  };
}
