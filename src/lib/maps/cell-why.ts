import type { StoredCompetitor } from "@/lib/maps/grid-entity";
import { haversineMiles } from "@/lib/maps/distance";
import { normalizeDomain } from "@/lib/competitors/resolve";

export type WhyBusiness = {
  rank: number;
  name: string;
  cid?: string | null;
  place_id?: string | null;
  rating?: number | null;
  review_count?: number | null;
  category?: string | null;
  address?: string | null;
  distanceMiles: number | null;
  reviewsLast30Days?: number | null;
};

export type VisibleGap = {
  text: string;
  field: string;
};

export type CellWhyResult = {
  selectedEntity: {
    name: string;
    rank: number | null;
    rating?: number | null;
    review_count?: number | null;
    category?: string | null;
  };
  searchPoint: { lat: number; lng: number };
  businessesAbove: WhyBusiness[];
  visibleGaps: VisibleGap[];
  confidence: "high" | "medium" | "low";
};

function parseCategoryTokens(category?: string | null): string[] {
  if (!category) return [];
  return category
    .split(/[,/]/)
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

function keywordMatchesCategory(keyword: string, category?: string | null): boolean {
  const tokens = parseCategoryTokens(category);
  const kw = keyword.toLowerCase();
  return tokens.some((t) => kw.includes(t) || t.includes(kw.split(" ")[0] ?? ""));
}

export function buildCellWhy(params: {
  keyword: string;
  cellLat: number;
  cellLng: number;
  selected: StoredCompetitor & { name: string };
  selectedRank: number | null;
  rawResults: StoredCompetitor[];
  enrichment?: Record<string, { reviewsLast30Days?: number | null }>;
}): CellWhyResult {
  const selectedRank = params.selectedRank ?? params.selected.rank ?? 21;
  const above = params.rawResults
    .filter((r) => {
      const rRank = r.rank ?? 99;
      return rRank < selectedRank && rRank <= 20;
    })
    .sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));

  const businessesAbove: WhyBusiness[] = above.map((r) => {
    const key = r.cid ?? r.place_id ?? r.name ?? "";
    return {
      rank: r.rank ?? 0,
      name: r.name ?? "—",
      cid: r.cid,
      place_id: r.place_id,
      rating: r.rating,
      review_count: r.review_count,
      category: r.category,
      address: r.address,
      distanceMiles:
        r.lat != null && r.lng != null
          ? Math.round(haversineMiles(params.cellLat, params.cellLng, r.lat, r.lng) * 10) / 10
          : null,
      reviewsLast30Days: key ? params.enrichment?.[key]?.reviewsLast30Days : undefined,
    };
  });

  const visibleGaps: VisibleGap[] = [];
  const selReviews = params.selected.review_count ?? 0;
  const selRating = params.selected.rating;

  for (const comp of businessesAbove.slice(0, 5)) {
    const compReviews = comp.review_count ?? 0;
    if (compReviews > selReviews * 1.5 && compReviews - selReviews >= 5) {
      visibleGaps.push({
        field: "reviews",
        text: `${comp.name} has ${compReviews} reviews vs ${selReviews} for the selected business.`,
      });
    }
    if (
      comp.distanceMiles != null &&
      comp.distanceMiles < 2 &&
      selReviews < compReviews
    ) {
      visibleGaps.push({
        field: "proximity",
        text: `${comp.name} is ${comp.distanceMiles} mi from this search point with stronger review volume.`,
      });
    }
    if (keywordMatchesCategory(params.keyword, comp.category) && !keywordMatchesCategory(params.keyword, params.selected.category)) {
      visibleGaps.push({
        field: "category",
        text: `${comp.name}'s category appears closer to "${params.keyword}".`,
      });
    }
    if ((comp.rating ?? 0) > (selRating ?? 0) + 0.3) {
      visibleGaps.push({
        field: "rating",
        text: `${comp.name} has a ${comp.rating} rating vs ${selRating ?? "—"}.`,
      });
    }
    if (comp.reviewsLast30Days != null && comp.reviewsLast30Days > 0 && (params.enrichment?.[params.selected.cid ?? ""]?.reviewsLast30Days ?? 0) === 0) {
      visibleGaps.push({
        field: "velocity",
        text: `${comp.name} has ${comp.reviewsLast30Days} reviews in the last 30 days.`,
      });
    }
  }

  const uniqueGaps = visibleGaps.filter(
    (g, i, arr) => arr.findIndex((x) => x.text === g.text) === i
  );

  return {
    selectedEntity: {
      name: params.selected.name,
      rank: params.selectedRank,
      rating: params.selected.rating,
      review_count: params.selected.review_count,
      category: params.selected.category,
    },
    searchPoint: { lat: params.cellLat, lng: params.cellLng },
    businessesAbove,
    visibleGaps: uniqueGaps.slice(0, 6),
    confidence: businessesAbove.length > 0 ? (uniqueGaps.length >= 2 ? "high" : "medium") : "low",
  };
}
