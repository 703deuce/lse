/**
 * Merge the extra-cities report into the main report, then emit a single flat
 * "all data points" comparison JSON (one row per business, every signal inlined).
 *
 * Usage (PowerShell):
 *   node scripts/review-velocity-merge.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const MAIN_PATH = resolve(ROOT, "scripts/review-velocity-report.json");
const EXTRA_PATH = resolve(ROOT, "scripts/review-velocity-extra.json");
const FLAT_PATH = resolve(ROOT, "scripts/review-velocity-comparison.json");

const main = JSON.parse(readFileSync(MAIN_PATH, "utf8"));
if (existsSync(EXTRA_PATH)) {
  const extra = JSON.parse(readFileSync(EXTRA_PATH, "utf8"));
  const seen = new Set(main.report.map((c) => c.label));
  for (const city of extra.report) {
    if (!seen.has(city.label)) {
      main.report.push(city);
      seen.add(city.label);
      console.log(`merged city → ${city.label}`);
    } else {
      console.log(`skipped (already present) → ${city.label}`);
    }
  }
  main.mergedAt = new Date().toISOString();
  writeFileSync(MAIN_PATH, JSON.stringify(main, null, 2));
  console.log(`Updated main report → ${MAIN_PATH}`);
}

// ---- build flat comparison ----
const domainCounts = new Map();
for (const city of main.report) {
  for (const b of city.businesses) {
    if (b.domain) domainCounts.set(b.domain, (domainCounts.get(b.domain) ?? 0) + 1);
  }
}

function cityShort(label) {
  return label.split(",")[0].replace(/\(.*\)/, "").trim();
}

const rows = [];
for (const city of main.report) {
  const label = cityShort(city.label);
  const businesses = city.businesses ?? [];
  // within-pack authority order by referring domains (desc)
  const authSorted = [...businesses].sort(
    (a, b) =>
      (b.refDomainsAuthority?.totalDofollowReferringDomains ?? 0) -
      (a.refDomainsAuthority?.totalDofollowReferringDomains ?? 0)
  );
  const authOrder = new Map(authSorted.map((b, i) => [b, i + 1]));
  // within-pack prominence order by total reviews (desc)
  const promSorted = [...businesses].sort((a, b) => (b.totalReviews ?? 0) - (a.totalReviews ?? 0));
  const promOrder = new Map(promSorted.map((b, i) => [b, i + 1]));

  for (const b of businesses) {
    const gmb = b.gmb ?? {};
    const cats = Array.isArray(gmb.primaryCategory) ? gmb.primaryCategory : [];
    const home = b.onPage ?? {};
    const landing = b.landing ?? {};
    const local = landing.onPage ?? null;
    rows.push({
      city: label,
      mapsRank: b.rank,
      name: b.name,
      franchise: b.domain ? (domainCounts.get(b.domain) ?? 0) > 1 : false,
      domain: b.domain ?? null,
      website: b.website ?? null,

      // proximity
      distanceMi: b.distanceMi ?? null,
      proximityOrder: b.proximityOrder ?? null,

      // prominence
      rating: b.rating ?? null,
      totalReviews: b.totalReviews ?? null,
      prominenceOrder: promOrder.get(b) ?? null,

      // review velocity
      reviews30d: b.reviews30d ?? null,
      reviews90d: b.reviews90d ?? null,
      reviews365d: b.reviews365d ?? null,
      reviewOrder90d: b.reviewOrder90d ?? null,
      daysSinceLastReview: b.daysSinceLast ?? null,
      newestReview: b.newestIso ?? null,

      // authority
      dofollowReferringDomains: b.refDomainsAuthority?.totalDofollowReferringDomains ?? null,
      strongestDomainRank: b.refDomainsAuthority?.summary?.strongestDomainRank ?? null,
      dofollowBacklinks: b.authority?.totalDofollowCount ?? null,
      authorityOrder: authOrder.get(b) ?? null,

      // GMB profile
      gmbPrimaryCategory: cats[0] ?? null,
      gmbPrimaryIsJunk: (cats[0] ?? "").toLowerCase() === "junk removal service",
      gmbCategoryCount: cats.length,
      gmbCategories: cats,
      gmbHasHours: gmb.hasHours ?? null,

      // on-page (homepage / GBP-linked page)
      homeTitle: home.title ?? null,
      homeKwCityInTitle: !!(home.kwInTitle && home.cityInTitle),

      // local landing page
      hasDedicatedLocalPage: !!landing.dedicatedLocalPage,
      landingUrl: landing.landingUrl ?? null,
      landingSource: landing.source ?? null,
      localTitle: local?.title ?? null,
      localKwCityInTitle: !!local?.kwCityInTitle,
      localKwCityInH1: !!local?.kwCityInH1,
      localWordCount: local?.wordCount ?? null,
    });
  }
}

const out = {
  generatedAt: new Date().toISOString(),
  cityCount: main.report.length,
  businessCount: rows.length,
  legend: {
    orders: "1 = best within its 3-business city pack (proximityOrder=closest, prominenceOrder=most total reviews, reviewOrder90d=most recent, authorityOrder=most referring domains)",
    franchise: "true when the domain appears in more than one city (shared corporate site)",
  },
  rows,
};
writeFileSync(FLAT_PATH, JSON.stringify(out, null, 2));
console.log(`Wrote flat comparison (${rows.length} businesses, ${main.report.length} cities) → ${FLAT_PATH}`);
