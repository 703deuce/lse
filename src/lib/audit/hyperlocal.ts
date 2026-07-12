import type { GbpProfile, LoadedCompetitor, ParsedPage } from "@/lib/audit/types";
import { crawlSitePages, suggestPageTitle } from "@/lib/audit/website-crawler";
import { normalizeText } from "@/lib/audit/types";
import { countCompetitorsMentioningArea } from "@/lib/audit/service-coverage";

export interface HyperLocalOpportunity {
  service: string;
  neighborhood: string;
  suggestedTitle: string;
  suggestedH1: string;
  status: "missing" | "weak" | "good";
  checks: Array<{ label: string; pass: boolean; note?: string }>;
  pageUrl?: string;
  competitorCount?: number;
  mentionedOnSite?: boolean;
}

export interface HyperLocalOptions {
  pages?: ParsedPage[];
  areas?: string[];
  competitors?: LoadedCompetitor[];
}

export async function runHyperLocalAudit(
  gbp: GbpProfile,
  areas: string[] = [],
  options?: HyperLocalOptions
): Promise<{ opportunities: HyperLocalOpportunity[]; score: number }> {
  const hoods = (options?.areas ?? areas).filter(Boolean);
  const competitors = options?.competitors ?? [];
  const primaryService =
    (gbp.services?.length ? gbp.services[0] : gbp.primaryCategory) ?? "service";
  const city = gbp.city ?? "your city";
  const pages =
    options?.pages?.length
      ? options.pages
      : gbp.website
        ? await crawlSitePages(gbp.website, 20).catch(() => [])
        : [];

  const opportunities: HyperLocalOpportunity[] = [];

  if (!hoods.length) {
    if (gbp.city) hoods.push(gbp.city);
    else return { opportunities: [], score: 0 };
  }

  for (const area of hoods.slice(0, 12)) {
    const areaNorm = normalizeText(area);
    const page = pages.find((p) => {
      const hay = normalizeText(`${p.title} ${p.url} ${p.h1.join(" ")} ${p.bodyText.slice(0, 600)}`);
      return hay.includes(areaNorm);
    });

    const mentionedOnSite =
      !!page ||
      pages.some((p) => normalizeText(p.bodyText).includes(areaNorm));

    const competitorCount = countCompetitorsMentioningArea(competitors, area, 20);

    if (!page) {
      opportunities.push({
        service: primaryService,
        neighborhood: area,
        suggestedTitle: suggestPageTitle(`${primaryService} in ${area}`, city, gbp.state),
        suggestedH1: `${primaryService} in ${area}`,
        status: "missing",
        competitorCount,
        mentionedOnSite: false,
        checks: [
          { label: "Dedicated page exists", pass: false },
          { label: "Area mentioned on site", pass: mentionedOnSite },
          { label: "H1 with service + area", pass: false },
          { label: "Local confirmation in content", pass: false },
          { label: "Competitors covering area", pass: competitorCount >= 2, note: `${competitorCount}/20` },
        ],
      });
      continue;
    }

    const checks = [
      { label: "Dedicated page exists", pass: true, note: page.url },
      { label: "Area mentioned on site", pass: true },
      {
        label: "H1 with service + area",
        pass: page.h1.some((h) => normalizeText(h).includes(areaNorm)),
      },
      {
        label: "Local confirmation in content",
        pass:
          normalizeText(page.bodyText.slice(0, 500)).includes(areaNorm) ||
          (gbp.city ? normalizeText(page.bodyText).includes(normalizeText(gbp.city)) : false),
      },
      {
        label: "Competitors covering area",
        pass: competitorCount >= 2,
        note: `${competitorCount}/20 competitors mention this area`,
      },
    ];

    const passCount = checks.filter((c) => c.pass).length;
    opportunities.push({
      service: primaryService,
      neighborhood: area,
      suggestedTitle: suggestPageTitle(`${primaryService} in ${area}`, city, gbp.state),
      suggestedH1: page.h1[0] ?? `${primaryService} in ${area}`,
      status: passCount >= 4 ? "good" : passCount >= 2 ? "weak" : "missing",
      checks,
      pageUrl: page.url,
      competitorCount,
      mentionedOnSite: true,
    });
  }

  const good = opportunities.filter((o) => o.status === "good").length;
  const score = opportunities.length ? Math.round((good / opportunities.length) * 100) : 0;
  return { opportunities, score };
}
