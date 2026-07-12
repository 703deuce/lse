import type { GbpProfile, ParsedPage } from "@/lib/audit/types";
import { crawlSitePages, pageMatchesService, suggestPageTitle } from "@/lib/audit/website-crawler";
import { normalizeText } from "@/lib/audit/types";

export interface Core30Result {
  completionScore: number;
  gbpServicesFound: number;
  matchingPagesFound: number;
  missingPages: Array<{ name: string; suggestedTitle: string }>;
  weakPages: Array<{ url: string; issue: string }>;
  wrongTitlePages: Array<{ url: string; title: string | null; expected: string }>;
  servicePageCount: number;
  locationPageCount: number;
}

export interface Core30Options {
  pages?: ParsedPage[];
}

export async function runCore30Audit(gbp: GbpProfile, options?: Core30Options): Promise<Core30Result> {
  const services = gbp.services?.length
    ? gbp.services
    : [gbp.primaryCategory, ...(gbp.secondaryCategories ?? [])].filter(Boolean) as string[];

  if (!gbp.website) {
    return {
      completionScore: 0,
      gbpServicesFound: services.length,
      matchingPagesFound: 0,
      missingPages: services.map((s) => ({ name: s, suggestedTitle: suggestPageTitle(s, gbp.city, gbp.state) })),
      weakPages: [],
      wrongTitlePages: [],
      servicePageCount: 0,
      locationPageCount: 0,
    };
  }

  const pages = options?.pages?.length
    ? options.pages
    : gbp.website
      ? await crawlSitePages(gbp.website, 20)
      : [];
  const servicePages = pages.filter((p) => /service|removal|junk|appliance|clean/i.test(p.url + p.title));
  const locationPages = pages.filter((p) => /location|area|city|county|near|neighborhood/i.test(p.url + p.title));

  const missingPages: Core30Result["missingPages"] = [];
  const weakPages: Core30Result["weakPages"] = [];
  const wrongTitlePages: Core30Result["wrongTitlePages"] = [];
  let matching = 0;

  for (const service of services.slice(0, 30)) {
    const matchPage = pages.find((p) => pageMatchesService(p, service));
    if (matchPage) {
      matching++;
      if (matchPage.wordCount < 250) {
        weakPages.push({ url: matchPage.url, issue: `Thin content (${matchPage.wordCount} words)` });
      }
      const expected = suggestPageTitle(service, gbp.city, gbp.state);
      if (matchPage.title && !normalizeText(matchPage.title).includes(normalizeText(service).split(" ")[0])) {
        wrongTitlePages.push({ url: matchPage.url, title: matchPage.title, expected });
      }
    } else {
      missingPages.push({ name: service, suggestedTitle: suggestPageTitle(service, gbp.city, gbp.state) });
    }
  }

  const target = Math.max(services.length, 1);
  const completionScore = Math.round((matching / target) * 100);

  return {
    completionScore,
    gbpServicesFound: services.length,
    matchingPagesFound: matching,
    missingPages,
    weakPages,
    wrongTitlePages,
    servicePageCount: servicePages.length,
    locationPageCount: locationPages.length,
  };
}
