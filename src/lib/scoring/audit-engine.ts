export interface AuditFindingInput {
  finding_type: string;
  bucket: "relevance" | "distance" | "prominence" | "trust";
  severity: "low" | "medium" | "high" | "critical";
  metric_key?: string;
  metric_value?: string;
  evidence_json?: Record<string, unknown>;
}

export interface AuditContext {
  target: {
    name: string;
    category?: string | null;
    rating?: number;
    review_count?: number;
    photo_count?: number;
    post_count?: number;
    is_claimed?: boolean;
    description?: string;
    additional_categories?: string[];
    recent_review_count?: number;
  };
  competitors: Array<{
    name?: string;
    category?: string;
    rating?: number;
    review_count?: number;
    photo_count?: number;
    post_count?: number;
    additional_categories?: string[];
    recent_review_count?: number;
  }>;
  scanMetrics: {
    averageRank: number | null;
    top10Cells: number;
    totalCells: number;
    ranksByDistance: Array<{ distanceM: number; rank: number | null }>;
  };
  websiteProbe?: {
    title: string | null;
    h1: string | null;
    keywordInTitle: boolean;
    keywordInH1: boolean;
  } | null;
  keyword?: string;
}

export interface AuditScores {
  relevance: number;
  distance: number;
  prominence: number;
  trust: number;
  overall: number;
}

function clampScore(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

export function runDeterministicAudit(ctx: AuditContext): {
  scores: AuditScores;
  findings: AuditFindingInput[];
} {
  const findings: AuditFindingInput[] = [];
  const comp = ctx.competitors.slice(0, 5);

  const avgCompReviews =
    comp.length > 0
      ? comp.reduce((s, c) => s + (c.review_count ?? 0), 0) / comp.length
      : 0;
  const avgCompRating =
    comp.length > 0
      ? comp.reduce((s, c) => s + (c.rating ?? 0), 0) / comp.length
      : 0;

  // Relevance
  let relevanceScore = 70;
  const compCategories = new Set(comp.flatMap((c) => [c.category, ...(c.additional_categories ?? [])].filter(Boolean)));
  if (ctx.target.category && !compCategories.has(ctx.target.category)) {
    findings.push({
      finding_type: "category_mismatch",
      bucket: "relevance",
      severity: "high",
      metric_key: "primary_category",
      metric_value: ctx.target.category,
      evidence_json: { competitor_categories: [...compCategories] },
    });
    relevanceScore -= 20;
  }

  if (!ctx.target.description || ctx.target.description.length < 100) {
    findings.push({
      finding_type: "weak_description",
      bucket: "relevance",
      severity: "medium",
      metric_key: "description_length",
      metric_value: String(ctx.target.description?.length ?? 0),
    });
    relevanceScore -= 10;
  }

  const compSecondary = new Set(
    comp.flatMap((c) => c.additional_categories ?? []).filter(Boolean)
  );
  const targetSecondary = ctx.target.additional_categories ?? [];
  const missingSecondary = [...compSecondary].filter(
    (c) => !targetSecondary.includes(c as string) && c !== ctx.target.category
  );
  if (missingSecondary.length >= 2) {
    findings.push({
      finding_type: "missing_secondary_categories",
      bucket: "relevance",
      severity: "medium",
      metric_key: "missing_categories",
      metric_value: missingSecondary.slice(0, 3).join(", "),
      evidence_json: { categories: missingSecondary },
    });
    relevanceScore -= 10;
  }

  if (ctx.websiteProbe && ctx.keyword) {
    if (!ctx.websiteProbe.keywordInTitle && !ctx.websiteProbe.keywordInH1) {
      findings.push({
        finding_type: "website_keyword_misalignment",
        bucket: "relevance",
        severity: "medium",
        metric_key: "keyword",
        metric_value: ctx.keyword,
        evidence_json: {
          title: ctx.websiteProbe.title,
          h1: ctx.websiteProbe.h1,
        },
      });
      relevanceScore -= 10;
    }
  }

  // Distance
  let distanceScore = 80;
  const farCells = ctx.scanMetrics.ranksByDistance.filter(
    (r) => r.distanceM > 1500 && (r.rank == null || r.rank > 10)
  );
  const nearWinCells = ctx.scanMetrics.ranksByDistance.filter(
    (r) => r.rank != null && r.rank >= 4 && r.rank <= 10
  );

  if (farCells.length > ctx.scanMetrics.totalCells * 0.4) {
    findings.push({
      finding_type: "distance_limited_visibility",
      bucket: "distance",
      severity: "medium",
      metric_key: "far_poor_cells",
      metric_value: String(farCells.length),
      evidence_json: { note: "Geography may limit wins in outer grid cells" },
    });
    distanceScore -= 15;
  }

  if (nearWinCells.length >= 3) {
    findings.push({
      finding_type: "near_win_opportunity",
      bucket: "distance",
      severity: "low",
      metric_key: "near_win_cells",
      metric_value: String(nearWinCells.length),
      evidence_json: { note: "Focus on cells where you rank 4-10" },
    });
    distanceScore += 5;
  }

  // Prominence
  let prominenceScore = 60;
  const targetReviews = ctx.target.review_count ?? 0;
  if (avgCompReviews > 0 && targetReviews < avgCompReviews * 0.5) {
    findings.push({
      finding_type: "review_volume_gap",
      bucket: "prominence",
      severity: "high",
      metric_key: "review_count",
      metric_value: String(targetReviews),
      evidence_json: { competitor_avg: Math.round(avgCompReviews) },
    });
    prominenceScore -= 25;
  }

  const targetRating = ctx.target.rating ?? 0;
  if (avgCompRating > 0 && targetRating < avgCompRating - 0.3) {
    findings.push({
      finding_type: "rating_gap",
      bucket: "prominence",
      severity: "medium",
      metric_key: "rating",
      metric_value: String(targetRating),
      evidence_json: { competitor_avg: avgCompRating.toFixed(1) },
    });
    prominenceScore -= 15;
  }

  const avgCompPhotos =
    comp.length > 0
      ? comp.reduce((s, c) => s + (c.photo_count ?? 0), 0) / comp.length
      : 0;
  if (avgCompPhotos > 0 && (ctx.target.photo_count ?? 0) < avgCompPhotos * 0.5) {
    findings.push({
      finding_type: "photo_count_gap",
      bucket: "prominence",
      severity: "medium",
      metric_key: "photo_count",
      metric_value: String(ctx.target.photo_count ?? 0),
      evidence_json: { competitor_avg: Math.round(avgCompPhotos) },
    });
    prominenceScore -= 10;
  }

  const avgCompPosts =
    comp.length > 0 ? comp.reduce((s, c) => s + (c.post_count ?? 0), 0) / comp.length : 0;
  if (avgCompPosts >= 2 && (ctx.target.post_count ?? 0) < 1) {
    findings.push({
      finding_type: "post_activity_gap",
      bucket: "prominence",
      severity: "medium",
      metric_key: "post_count",
      metric_value: String(ctx.target.post_count ?? 0),
      evidence_json: { competitor_avg: Math.round(avgCompPosts) },
    });
    prominenceScore -= 10;
  }

  const avgRecentReviews =
    comp.length > 0
      ? comp.reduce((s, c) => s + (c.recent_review_count ?? 0), 0) / comp.length
      : 0;
  if (avgRecentReviews >= 3 && (ctx.target.recent_review_count ?? 0) < avgRecentReviews * 0.3) {
    findings.push({
      finding_type: "review_recency_gap",
      bucket: "prominence",
      severity: "high",
      metric_key: "recent_reviews_30d",
      metric_value: String(ctx.target.recent_review_count ?? 0),
      evidence_json: { competitor_avg: Math.round(avgRecentReviews) },
    });
    prominenceScore -= 15;
  }

  // Trust
  let trustScore = 75;
  if (ctx.target.is_claimed === false) {
    findings.push({
      finding_type: "unclaimed_profile",
      bucket: "trust",
      severity: "critical",
      metric_key: "is_claimed",
      metric_value: "false",
    });
    trustScore -= 30;
  }

  if ((ctx.target.photo_count ?? 0) === 0) {
    findings.push({
      finding_type: "no_recent_media",
      bucket: "trust",
      severity: "medium",
      metric_key: "photo_count",
      metric_value: "0",
    });
    trustScore -= 10;
  }

  const overall = clampScore(
    relevanceScore * 0.3 + distanceScore * 0.2 + prominenceScore * 0.35 + trustScore * 0.15
  );

  return {
    scores: {
      relevance: clampScore(relevanceScore),
      distance: clampScore(distanceScore),
      prominence: clampScore(prominenceScore),
      trust: clampScore(trustScore),
      overall,
    },
    findings,
  };
}

export function findingsToActionItems(
  findings: AuditFindingInput[]
): Array<{
  title: string;
  description: string;
  bucket: string;
  impact: string;
  effort: string;
  priority_rank: number;
  evidence_json: Record<string, unknown>;
}> {
  const templates: Record<string, { title: string; description: string; impact: string; effort: string }> = {
    category_mismatch: {
      title: "Add missing categories competitors use",
      description: "Your primary category may not match what Google shows for this query. Review competitor categories and add relevant secondary categories.",
      impact: "high",
      effort: "low",
    },
    weak_description: {
      title: "Expand your business description",
      description: "Write a detailed description that mentions your services and target keyword naturally.",
      impact: "medium",
      effort: "low",
    },
    review_volume_gap: {
      title: "Increase review volume",
      description: "Competitors have significantly more reviews. Launch a review request campaign for recent customers.",
      impact: "high",
      effort: "medium",
    },
    rating_gap: {
      title: "Improve average rating",
      description: "Your rating trails top competitors. Follow up on recent negative reviews and resolve service issues.",
      impact: "medium",
      effort: "medium",
    },
    photo_count_gap: {
      title: "Add more photos to your profile",
      description: "Competitors show more photos. Upload recent work, team, and location photos weekly.",
      impact: "medium",
      effort: "low",
    },
    unclaimed_profile: {
      title: "Claim your Google Business Profile",
      description: "Your listing appears unclaimed. Verify ownership to unlock full management.",
      impact: "high",
      effort: "low",
    },
    distance_limited_visibility: {
      title: "Focus on near-win grid cells",
      description: "Distance limits visibility in outer areas. Prioritize zones where you already rank 4-10 rather than far cells.",
      impact: "medium",
      effort: "medium",
    },
    near_win_opportunity: {
      title: "Push near-win locations into top 3",
      description: "Several grid cells rank 4-10. Small prominence improvements could move these into the local pack.",
      impact: "high",
      effort: "medium",
    },
    missing_secondary_categories: {
      title: "Add competitor-used secondary categories",
      description: "Top competitors use categories you are missing. Add relevant secondary categories to your profile.",
      impact: "high",
      effort: "low",
    },
    website_keyword_misalignment: {
      title: "Align website title/H1 with target keyword",
      description: "Your public website does not mention the target keyword in the title or main heading.",
      impact: "medium",
      effort: "low",
    },
    post_activity_gap: {
      title: "Publish Google posts regularly",
      description: "Competitors are posting updates while you are not. Add weekly posts with offers or updates.",
      impact: "medium",
      effort: "low",
    },
    review_recency_gap: {
      title: "Increase fresh review activity",
      description: "Competitors have much fresher review activity. Ask recent customers for reviews.",
      impact: "high",
      effort: "medium",
    },
    no_recent_media: {
      title: "Upload recent photos",
      description: "Your profile lacks photos. Add recent work, team, and location images.",
      impact: "medium",
      effort: "low",
    },
  };

  const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };

  return findings
    .sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity])
    .slice(0, 7)
    .map((f, i) => {
      const t = templates[f.finding_type] ?? {
        title: f.finding_type.replace(/_/g, " "),
        description: f.metric_value ?? "Review this finding",
        impact: "medium",
        effort: "medium",
      };
      return {
        title: t.title,
        description: t.description,
        bucket: f.bucket,
        impact: t.impact,
        effort: t.effort,
        priority_rank: i + 1,
        evidence_json: f.evidence_json ?? { finding_type: f.finding_type },
      };
    });
}
