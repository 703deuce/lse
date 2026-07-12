import type { GbpProfile, LoadedCompetitor, AuditCheck } from "@/lib/audit/types";
import { runWebsiteMatchAudit } from "@/lib/audit/website-match";
import type { Core30Result } from "@/lib/audit/core30";
import { crawlSitePages } from "@/lib/audit/website-crawler";
import type { CategoryAlignmentResult } from "@/lib/audit/category-alignment";
import type { BacklinkGapSummary } from "@/lib/growth-audit/backlink-summary";

export interface CompetitorGapOptions {
  core30?: Core30Result;
  websiteChecks?: AuditCheck[];
  categoryAlignment?: CategoryAlignmentResult;
  backlinkGap?: BacklinkGapSummary | null;
}

export interface CompetitorSnapshot {
  name: string;
  rank?: number;
  categories: string[];
  rating: number;
  reviewCount: number;
  photoCount: number;
  postCount: number;
  reviewKeywords: string[];
  websiteTitle?: string | null;
  homepageWordCount?: number;
  servicePageCount?: number;
  localPageCount?: number;
  napMatch?: boolean;
  clickToCall?: boolean;
  hoursMatch?: boolean;
}

export interface CompetitorGapMetrics {
  reviews: { you: number; top3Avg: number; top20Avg: number };
  servicePages: { you: number; top3Avg: number };
  localPages: { you: number; top3Avg: number };
  categories: { you: number; top3Avg: number };
  referringDomains?: { you: number; competitorTotal: number };
}

export interface CompetitorGapResult {
  competitors: CompetitorSnapshot[];
  whyTheyBeatYou: string[];
  yourGaps: string[];
  metrics?: CompetitorGapMetrics;
  competitorCount?: number;
  backlinkGap?: BacklinkGapSummary | null;
}

function avg(nums: number[]): number {
  if (!nums.length) return 0;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

export async function runCompetitorGapAudit(
  gbp: GbpProfile,
  competitors: LoadedCompetitor[],
  options?: CompetitorGapOptions
): Promise<CompetitorGapResult> {
  const top20 = competitors.slice(0, 20);
  const top3 = top20.slice(0, 3);
  const snapshots: CompetitorSnapshot[] = [];

  for (const c of top3) {
    let websiteTitle: string | null = null;
    let homepageWordCount = 0;
    let servicePageCount = 0;
    let localPageCount = 0;
    let clickToCall = false;

    if (c.website) {
      try {
        const pages = await crawlSitePages(c.website, 8);
        websiteTitle = pages[0]?.title ?? null;
        homepageWordCount = pages[0]?.wordCount ?? 0;
        clickToCall = pages[0]?.hasClickToCall ?? false;
        servicePageCount = pages.filter((p) => /service|removal/i.test(p.url)).length;
        localPageCount = pages.filter((p) => /location|area|city|near/i.test(p.url)).length;
      } catch {
        /* skip */
      }
    }

    snapshots.push({
      name: c.name,
      rank: c.rank,
      categories: [c.category, ...(c.additionalCategories ?? [])].filter(Boolean) as string[],
      rating: c.rating ?? 0,
      reviewCount: c.reviewCount ?? 0,
      photoCount: c.photoCount ?? 0,
      postCount: c.postCount ?? 0,
      reviewKeywords: c.reviewKeywords ?? [],
      websiteTitle,
      homepageWordCount,
      servicePageCount,
      localPageCount,
      clickToCall,
    });
  }

  const whyTheyBeatYou: string[] = [];
  const yourGaps: string[] = [];

  const yourReviews = gbp.reviewCount ?? 0;
  const top3ReviewAvg = avg(top3.map((c) => c.reviewCount ?? 0));
  const top20ReviewAvg = avg(top20.map((c) => c.reviewCount ?? 0));

  if (top3ReviewAvg > yourReviews * 1.5) {
    whyTheyBeatYou.push(
      `Top competitors average ${top3ReviewAvg} reviews vs your ${yourReviews} — review volume is a visible prominence gap in Maps results.`
    );
    yourGaps.push("Increase review velocity with post-job SMS/email requests");
  }

  const compServicePages = Math.max(...snapshots.map((s) => s.servicePageCount ?? 0), 0);
  let core30: Core30Result = options?.core30 ?? {
    missingPages: [],
    weakPages: [],
    wrongTitlePages: [],
    completionScore: 0,
    gbpServicesFound: 0,
    matchingPagesFound: 0,
    servicePageCount: 0,
    locationPageCount: 0,
  };
  if (!options?.core30 && gbp.website) {
    const { runCore30Audit } = await import("@/lib/audit/core30");
    core30 = await runCore30Audit(gbp);
  }
  if (compServicePages > 0 && core30.missingPages.length > 0) {
    whyTheyBeatYou.push(
      `Competitors in the top 3 have dedicated service pages (up to ${compServicePages}) while you are missing ${core30.missingPages.length} pages for GBP-listed services.`
    );
    yourGaps.push(`Build pages for: ${core30.missingPages.slice(0, 3).map((p) => p.name).join(", ")}`);
  }

  const alignment = options?.categoryAlignment;
  const categoryRecs = alignment?.recommendations ?? [];
  if (categoryRecs.length > 0) {
    const top = categoryRecs[0];
    whyTheyBeatYou.push(top.recommendationText);
    if (top.confidence === "high") {
      yourGaps.push(
        `Review category alignment: "${top.category}" is used by ${top.top3Count}/3 top competitors and ${top.top20Count}/${top.totalCompetitors} in the top 20 — add only if accurate`
      );
    }
  } else if (alignment && alignment.reviewIdeas.length > 0) {
    whyTheyBeatYou.push(
      "Some categories appear occasionally among ranking competitors. Review category alignment before making GBP changes."
    );
  }

  const top3PhotoAvg = avg(top3.map((c) => c.photoCount ?? 0));
  if ((gbp.photoCount ?? 0) < top3PhotoAvg) {
    whyTheyBeatYou.push(
      `Top competitors have more GBP photos (avg ${top3PhotoAvg} vs your ${gbp.photoCount ?? 0}).`
    );
    yourGaps.push("Upload 5+ geo-tagged photos weekly");
  }

  if (gbp.website) {
    const webChecks =
      options?.websiteChecks ?? (await runWebsiteMatchAudit(gbp)).checks;
    const napIssues = webChecks
      .filter((c) => c.id.includes("phone") || c.id.includes("address"))
      .filter((c) => c.status !== "match");
    if (napIssues.length) {
      whyTheyBeatYou.push(
        "Website NAP mismatch may hurt trust compared with competitors whose profiles and sites align."
      );
      yourGaps.push("Align website NAP with your Google Business Profile");
    }
  }

  const backlink = options?.backlinkGap;
  if (backlink?.available) {
    if (backlink.competitorReferringDomains > backlink.yourReferringDomains * 1.3) {
      whyTheyBeatYou.push(
        `Competitors have more referring domains in backlink analysis (${backlink.competitorReferringDomains} vs your ${backlink.yourReferringDomains}).`
      );
      yourGaps.push(
        `Review ${backlink.missingOpportunities} backlink gap opportunities (${backlink.highPriorityCount} high priority)`
      );
    }
  }

  if (!whyTheyBeatYou.length) {
    whyTheyBeatYou.push(
      "You are competitive on core signals visible in Maps results — focus on coverage gaps and review velocity for the next lift."
    );
  }

  const yourCats = [gbp.primaryCategory, ...(gbp.secondaryCategories ?? [])].filter(Boolean).length;
  const top3CatAvg = avg(
    top3.map((c) => [c.category, ...(c.additionalCategories ?? [])].filter(Boolean).length)
  );

  const metrics: CompetitorGapMetrics = {
    reviews: { you: yourReviews, top3Avg: top3ReviewAvg, top20Avg: top20ReviewAvg },
    servicePages: { you: core30.servicePageCount, top3Avg: avg(snapshots.map((s) => s.servicePageCount ?? 0)) },
    localPages: { you: core30.locationPageCount, top3Avg: avg(snapshots.map((s) => s.localPageCount ?? 0)) },
    categories: { you: yourCats, top3Avg: top3CatAvg },
    referringDomains: backlink?.available
      ? { you: backlink.yourReferringDomains, competitorTotal: backlink.competitorReferringDomains }
      : undefined,
  };

  return {
    competitors: snapshots,
    whyTheyBeatYou,
    yourGaps,
    metrics,
    competitorCount: top20.length,
    backlinkGap: backlink ?? null,
  };
}
