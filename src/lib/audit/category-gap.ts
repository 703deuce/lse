import type { GbpProfile, ParsedPage } from "@/lib/audit/types";
import { crawlSitePages, pageMatchesService, suggestPageTitle } from "@/lib/audit/website-crawler";
import {
  analyzeCategoryAlignment,
  type CategoryAlignmentResult,
} from "@/lib/audit/category-alignment";
import type { LoadedCompetitor } from "@/lib/audit/types";

export interface CategoryGapResult {
  primaryCategory: string | null;
  secondaryCategories: string[];
  competitorCategories: string[];
  missingOpportunities: string[];
  services: string[];
  missingPages: Array<{ service: string; suggestedTitle: string; reason: string }>;
  categoryAlignment?: CategoryAlignmentResult;
}

export interface CategoryGapOptions {
  pages?: ParsedPage[];
  competitors?: LoadedCompetitor[];
}

export async function runCategoryGapAudit(
  gbp: GbpProfile,
  competitorCategories: string[] = [],
  options?: CategoryGapOptions
): Promise<CategoryGapResult> {
  const services = gbp.services?.length
    ? gbp.services
    : [gbp.primaryCategory, ...(gbp.secondaryCategories ?? [])].filter(Boolean) as string[];

  const competitors = options?.competitors ?? [];
  const alignment = analyzeCategoryAlignment(gbp, competitors);

  const missingOpportunities = alignment.recommendations.map((r) => r.category);

  const missingPages: CategoryGapResult["missingPages"] = [];
  let pages: ParsedPage[] = options?.pages ?? [];

  if (!pages.length && gbp.website) {
    try {
      pages = await crawlSitePages(gbp.website, 15);
    } catch {
      /* no crawl */
    }
  }

  for (const service of services.slice(0, 20)) {
    if (!service) continue;
    const hasPage = pages.some((p) => pageMatchesService(p, service));
    if (!hasPage) {
      missingPages.push({
        service,
        suggestedTitle: suggestPageTitle(service, gbp.city, gbp.state),
        reason: "Listed service/category but no dedicated matching page found.",
      });
    }
  }

  return {
    primaryCategory: gbp.primaryCategory ?? null,
    secondaryCategories: gbp.secondaryCategories ?? [],
    competitorCategories,
    missingOpportunities,
    services,
    missingPages,
    categoryAlignment: alignment,
  };
}
