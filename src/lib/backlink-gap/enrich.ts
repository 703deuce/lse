import { assessTopicalFit, linkPassesPower, rankToPower, type TopicalFit } from "@/lib/backlink-gap/power";

export type RawOpportunity = {
  id: string;
  referring_domain: string;
  source_url: string | null;
  source_title: string | null;
  source_type: string;
  domain_rank: number | null;
  authority_score: number | null;
  competitor_count: number;
  linked_competitors: Array<{ name?: string; domain?: string | null; id?: string }>;
  target_has_link: boolean;
  anchor_text: string | null;
  dofollow: boolean | null;
  first_seen: string | null;
  last_seen: string | null;
  opportunity_score: number;
  priority: string;
  suggested_action: string | null;
  reason: string | null;
  status: string;
  raw_json?: Record<string, unknown>;
};

export type EnrichedOpportunity = RawOpportunity & {
  powerScore: number | null;
  topicalFit: TopicalFit;
  linkPassing: "passes" | "nofollow" | "unknown";
};

export type BusinessContext = {
  category?: string | null;
  keyword?: string | null;
  city?: string | null;
};

export function enrichOpportunity(opp: RawOpportunity, ctx?: BusinessContext): EnrichedOpportunity {
  const storedTopical = opp.raw_json?.topical_fit as TopicalFit | undefined;
  const powerScore =
    opp.authority_score != null
      ? Math.round(Number(opp.authority_score))
      : rankToPower(opp.domain_rank != null ? Number(opp.domain_rank) : null);

  const topicalFit =
    storedTopical ??
    assessTopicalFit({
      anchor: opp.anchor_text,
      title: opp.source_title,
      domain: opp.referring_domain,
      sourceType: opp.source_type,
      category: ctx?.category,
      keyword: ctx?.keyword,
      city: ctx?.city,
    });

  return {
    ...opp,
    powerScore,
    topicalFit,
    linkPassing: linkPassesPower(opp.dofollow),
  };
}

export function enrichOpportunities(rows: RawOpportunity[], ctx?: BusinessContext): EnrichedOpportunity[] {
  return rows.map((r) => enrichOpportunity(r, ctx));
}

export function filterOpportunities(
  rows: EnrichedOpportunity[],
  filters: {
    linkFilter: "all" | "dofollow" | "nofollow";
    topicalFilter: "all" | "topical" | "random";
    competitorName?: string | null;
  }
): EnrichedOpportunity[] {
  return rows.filter((o) => {
    if (filters.competitorName) {
      const names = (o.linked_competitors ?? []).map((c) => c.name).filter(Boolean);
      if (!names.includes(filters.competitorName)) return false;
    }
    if (filters.linkFilter === "dofollow" && o.linkPassing !== "passes") return false;
    if (filters.linkFilter === "nofollow" && o.linkPassing !== "nofollow") return false;
    if (filters.topicalFilter === "topical" && o.topicalFit !== "topical") return false;
    if (filters.topicalFilter === "random" && o.topicalFit !== "random") return false;
    return true;
  });
}

export function sortByPower(rows: EnrichedOpportunity[]): EnrichedOpportunity[] {
  return [...rows].sort((a, b) => {
    const pa = a.powerScore ?? 0;
    const pb = b.powerScore ?? 0;
    if (pb !== pa) return pb - pa;
    return b.opportunity_score - a.opportunity_score;
  });
}

export function groupByCompetitor(
  rows: EnrichedOpportunity[],
  competitors: Array<{ name: string; domain?: string | null }>
): Array<{ competitor: { name: string; domain?: string | null }; items: EnrichedOpportunity[] }> {
  const groups = competitors.map((comp) => ({
    competitor: comp,
    items: sortByPower(
      rows.filter((o) => (o.linked_competitors ?? []).some((c) => c.name === comp.name))
    ),
  }));

  const multi = rows.filter((o) => (o.linked_competitors ?? []).length > 1);
  if (multi.length > 0) {
    groups.push({
      competitor: { name: "Multiple competitors", domain: null },
      items: sortByPower(multi),
    });
  }

  return groups.filter((g) => g.items.length > 0);
}

export function paginate<T>(items: T[], page: number, pageSize: number): { items: T[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(0, page), totalPages - 1);
  const start = safePage * pageSize;
  return { items: items.slice(start, start + pageSize), totalPages };
}
