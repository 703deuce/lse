import type { HyperLocalOpportunity } from "@/lib/audit/hyperlocal";
import type { GbpProfile, LoadedCompetitor } from "@/lib/audit/types";
import type { ServiceArea } from "@/lib/growth-audit/local-areas";
import type { LocalCoverageRow, LocalCoverageSection } from "@/lib/growth-audit/types";

export function buildLocalCoverageSection(
  gbp: GbpProfile,
  hyperlocal: { opportunities: HyperLocalOpportunity[]; score: number },
  serviceAreas: ServiceArea[],
  _competitors: LoadedCompetitor[]
): LocalCoverageSection {
  const areaType = new Map(serviceAreas.map((a) => [a.name.toLowerCase(), a.type]));
  const neighborhoods: LocalCoverageRow[] = [];
  const cities: LocalCoverageRow[] = [];
  const seen = new Set<string>();

  for (const opp of hyperlocal.opportunities) {
    const key = opp.neighborhood.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);

    const type = areaType.get(key) ?? (opp.neighborhood === gbp.city ? "city" : "neighborhood");
    const competitorCount = opp.competitorCount ?? 0;
    const hasPage = opp.status === "good" || !!opp.pageUrl;

    const row: LocalCoverageRow = {
      area: opp.neighborhood,
      type,
      hasPage,
      mentionedOnSite: opp.mentionedOnSite ?? hasPage,
      competitorCount,
      opportunity:
        !hasPage && competitorCount >= 3
          ? "high"
          : !hasPage && competitorCount >= 1
            ? "medium"
            : opp.status === "weak"
              ? "medium"
              : "low",
      status:
        opp.status === "good" ? "excellent" : opp.status === "weak" ? "needs_improvement" : "missing",
    };

    if (type === "city") cities.push(row);
    else neighborhoods.push(row);
  }

  if (!cities.length && gbp.city && !seen.has(gbp.city.toLowerCase())) {
    const cityOpp = hyperlocal.opportunities.find(
      (o) => o.neighborhood.toLowerCase() === gbp.city!.toLowerCase()
    );
    const hasCityPage = cityOpp?.status === "good" || hyperlocal.score >= 50;
    cities.push({
      area: gbp.city,
      type: "city",
      hasPage: hasCityPage,
      mentionedOnSite: cityOpp?.mentionedOnSite,
      competitorCount: cityOpp?.competitorCount ?? 0,
      opportunity: hasCityPage ? "low" : "high",
      status: hasCityPage ? "excellent" : "needs_improvement",
    });
  }

  return {
    score: hyperlocal.score,
    neighborhoods,
    cities,
    opportunities: hyperlocal.opportunities,
  };
}
