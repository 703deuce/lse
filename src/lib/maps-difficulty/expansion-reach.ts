import { haversineMiles } from "@/lib/maps-difficulty/distance";

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

export type ReachLabel =
  | "Inside Current Pack Radius"
  | "Near Current Pack Radius"
  | "Outside Current Pack Radius"
  | "Far Outside Current Pack Radius"
  | "Likely Outside Practical Maps Reach";

export type PackTightness =
  | "Tight local pack"
  | "Moderate local pack"
  | "Wide local pack"
  | "Very wide / sparse-market pack";

export type ExpansionDifficultyLabel =
  | "Easy Expansion"
  | "Possible but Competitive"
  | "Hard Expansion"
  | "Very Hard Expansion"
  | "Unlikely from Current Base";

export interface ExpansionReachCompetitor {
  rank: number;
  name: string;
  distanceMi: number;
}

export interface ExpansionReachResult {
  businessBaseInput: string;
  businessBaseLabel: string;
  businessBaseLat: number;
  businessBaseLng: number;
  businessDistanceToSearchPin: number;
  top3CompetitorDistances: ExpansionReachCompetitor[];
  top3MinDistance: number;
  top3MedianDistance: number;
  top3MaxDistance: number;
  top3AverageDistance: number;
  packTightness: PackTightness;
  reachLabel: ReachLabel;
  reachPenalty: number;
  distanceRatio: number | null;
  message: string;
  explanation: string;
  mapsKeywordDifficulty: number;
  expansionDifficultyScore: number;
  expansionDifficultyLabel: ExpansionDifficultyLabel;
}

function packTightnessFromMax(maxDist: number): PackTightness {
  if (maxDist <= 3) return "Tight local pack";
  if (maxDist <= 8) return "Moderate local pack";
  if (maxDist <= 20) return "Wide local pack";
  return "Very wide / sparse-market pack";
}

function getExpansionDifficultyLabel(score: number): ExpansionDifficultyLabel {
  if (score <= 30) return "Easy Expansion";
  if (score <= 50) return "Possible but Competitive";
  if (score <= 70) return "Hard Expansion";
  if (score <= 85) return "Very Hard Expansion";
  return "Unlikely from Current Base";
}

function lerpPenalty(lo: number, hi: number, t: number): number {
  return lo + (hi - lo) * Math.min(1, Math.max(0, t));
}

function classifyReach(D: number, X: number): { label: ReachLabel; penalty: number; message: string } {
  if (X <= 2) {
    if (D <= 2) {
      const t = D / Math.max(X, 0.1);
      return {
        label: D <= X ? "Inside Current Pack Radius" : "Near Current Pack Radius",
        penalty: round1(lerpPenalty(0, 10, t)),
        message:
          D <= X
            ? "Your base location is within the distance range of businesses currently ranking in the top 3."
            : "Your base location is slightly outside the current top-3 distance range. Expansion may be possible, but proximity is a disadvantage.",
      };
    }
    if (D <= 5) {
      return {
        label: "Outside Current Pack Radius",
        penalty: round1(lerpPenalty(20, 35, (D - 2) / 3)),
        message: "Your base location is meaningfully farther from the search point than the current top-3 businesses.",
      };
    }
    if (D <= 10) {
      return {
        label: "Far Outside Current Pack Radius",
        penalty: round1(lerpPenalty(35, 50, (D - 5) / 5)),
        message: "Your base location is far beyond the distance range currently represented in the top 3.",
      };
    }
    return {
      label: "Likely Outside Practical Maps Reach",
      penalty: round1(Math.min(65, 50 + (D - 10) * 1.5)),
      message: "Based on the current Map Pack radius, this target area appears geographically difficult to compete in from your base location.",
    };
  }

  if (X <= 5) {
    if (D <= X) {
      return {
        label: "Inside Current Pack Radius",
        penalty: round1(lerpPenalty(0, 10, D / X)),
        message: "Your base location is within the distance range of businesses currently ranking in the top 3.",
      };
    }
    if (D <= X * 1.5) {
      return {
        label: "Near Current Pack Radius",
        penalty: round1(lerpPenalty(10, 20, (D - X) / (X * 0.5))),
        message: "Your base location is slightly outside the current top-3 distance range. Expansion may be possible, but proximity is a disadvantage.",
      };
    }
    if (D <= 10) {
      return {
        label: "Outside Current Pack Radius",
        penalty: round1(lerpPenalty(20, 35, (D - X * 1.5) / (10 - X * 1.5))),
        message: "Your base location is meaningfully farther from the search point than the current top-3 businesses.",
      };
    }
    if (D <= 15) {
      return {
        label: "Far Outside Current Pack Radius",
        penalty: round1(lerpPenalty(35, 50, (D - 10) / 5)),
        message: "Your base location is far beyond the distance range currently represented in the top 3.",
      };
    }
    return {
      label: "Likely Outside Practical Maps Reach",
      penalty: round1(Math.min(65, 50 + (D - 15))),
      message: "Based on the current Map Pack radius, this target area appears geographically difficult to compete in from your base location.",
    };
  }

  if (X <= 10) {
    if (D <= X) {
      return {
        label: "Inside Current Pack Radius",
        penalty: round1(lerpPenalty(0, 10, D / X)),
        message: "Your base location is within the distance range of businesses currently ranking in the top 3.",
      };
    }
    if (D <= X * 1.5) {
      return {
        label: "Near Current Pack Radius",
        penalty: round1(lerpPenalty(10, 20, (D - X) / (X * 0.5))),
        message: "Your base location is slightly outside the current top-3 distance range. Expansion may be possible, but proximity is a disadvantage.",
      };
    }
    if (D <= 20) {
      const ratio = D / X;
      if (ratio <= 2.5) {
        return {
          label: "Outside Current Pack Radius",
          penalty: round1(lerpPenalty(20, 35, (D - X * 1.5) / (X * 2.5 - X * 1.5))),
          message: "Your base location is meaningfully farther from the search point than the current top-3 businesses.",
        };
      }
      return {
        label: "Far Outside Current Pack Radius",
        penalty: round1(lerpPenalty(35, 50, (D - X * 2.5) / (20 - X * 2.5))),
        message: "Your base location is far beyond the distance range currently represented in the top 3.",
      };
    }
    return {
      label: "Likely Outside Practical Maps Reach",
      penalty: round1(Math.min(65, 50 + (D - 20) * 0.75)),
      message: "Based on the current Map Pack radius, this target area appears geographically difficult to compete in from your base location.",
    };
  }

  // Wide / sparse pack
  if (D <= X) {
    return {
      label: "Inside Current Pack Radius",
      penalty: round1(lerpPenalty(0, 10, D / X)),
      message: "Your base location is within the distance range of businesses currently ranking in the top 3.",
    };
  }
  if (D <= X * 1.5) {
    return {
      label: "Near Current Pack Radius",
      penalty: round1(lerpPenalty(10, 20, (D - X) / (X * 0.5))),
      message: "Your base location is slightly outside the current top-3 distance range. Expansion may be possible, but proximity is a disadvantage.",
    };
  }
  if (D <= X * 2.5) {
    return {
      label: "Outside Current Pack Radius",
      penalty: round1(lerpPenalty(20, 35, (D - X * 1.5) / (X * 2.5 - X * 1.5))),
      message: "Your base location is meaningfully farther from the search point than the current top-3 businesses.",
    };
  }
  if (D <= X * 4) {
    return {
      label: "Far Outside Current Pack Radius",
      penalty: round1(lerpPenalty(35, 50, (D - X * 2.5) / (X * 4 - X * 2.5))),
      message: "Your base location is far beyond the distance range currently represented in the top 3.",
    };
  }
  return {
    label: "Likely Outside Practical Maps Reach",
    penalty: round1(lerpPenalty(50, 65, Math.min(1, (D - X * 4) / X))),
    message: "Based on the current Map Pack radius, this target area appears geographically difficult to compete in from your base location.",
  };
}

export function computeExpansionReach(params: {
  mapsKeywordDifficulty: number;
  targetLocationLabel: string;
  searchPoint: { lat: number; lng: number };
  businessBaseInput: string;
  businessBaseLabel: string;
  businessBaseLat: number;
  businessBaseLng: number;
  competitors: ExpansionReachCompetitor[];
}): ExpansionReachResult {
  const distances = params.competitors.map((c) => c.distanceMi).filter((d) => Number.isFinite(d));
  if (distances.length === 0) {
    throw new Error("Expansion Reach needs competitor distance data. Run a fresh Maps KD check for this keyword/location.");
  }

  const businessDistance =
    haversineMiles(
      { lat: params.businessBaseLat, lng: params.businessBaseLng },
      { lat: params.searchPoint.lat, lng: params.searchPoint.lng }
    ) ?? 0;

  const top3MinDistance = round1(Math.min(...distances));
  const top3MaxDistance = round1(Math.max(...distances));
  const top3MedianDistance = round1(median(distances));
  const top3AverageDistance = round1(distances.reduce((a, b) => a + b, 0) / distances.length);

  const X = top3MaxDistance;
  const D = businessDistance;
  const { label: reachLabel, penalty: reachPenalty, message } = classifyReach(D, X);
  const distanceRatio = X > 0 ? round1(D / X) : null;

  const packTightness = packTightnessFromMax(X);
  const expansionDifficultyScore = Math.min(100, Math.max(0, Math.round(params.mapsKeywordDifficulty + reachPenalty)));
  const expansionDifficultyLabel = getExpansionDifficultyLabel(expansionDifficultyScore);

  const distList = params.competitors.map((c) => `${c.distanceMi}`).join(", ");

  const explanation =
    `Your business base is ${D} miles from the target search point. The current top 3 businesses are ${distList} miles away, with a top-3 range of ${top3MinDistance}–${top3MaxDistance} miles. This is a ${packTightness}. Because your base is ${distanceRatio ?? "N/A"}x farther than the farthest current top-3 business, this target area is classified as ${reachLabel}. ` +
    "This does not mean ranking is impossible. It means proximity is a major disadvantage based on the businesses currently ranking in the top 3. " +
    "Expansion may require stronger signals than the current competitors, such as stronger brand demand, reviews, authority, and relevance.";

  return {
    businessBaseInput: params.businessBaseInput,
    businessBaseLabel: params.businessBaseLabel,
    businessBaseLat: params.businessBaseLat,
    businessBaseLng: params.businessBaseLng,
    businessDistanceToSearchPin: D,
    top3CompetitorDistances: params.competitors,
    top3MinDistance,
    top3MedianDistance,
    top3MaxDistance,
    top3AverageDistance,
    packTightness,
    reachLabel,
    reachPenalty,
    distanceRatio,
    message,
    explanation,
    mapsKeywordDifficulty: params.mapsKeywordDifficulty,
    expansionDifficultyScore,
    expansionDifficultyLabel,
  };
}

/** Build competitor list from a completed KD result. */
export function competitorsFromKdResult(
  top3Summary: { rank: number; name: string; distanceMi: number | null }[]
): ExpansionReachCompetitor[] {
  return top3Summary
    .filter((b) => b.distanceMi != null)
    .map((b) => ({ rank: b.rank, name: b.name, distanceMi: b.distanceMi as number }));
}
