/**
 * Maps Keyword Difficulty (MKD) — v1 scoring engine.
 *
 * Concept: like Ahrefs Keyword Difficulty, but for the Google Maps 3-pack.
 *   "How hard would it be to break into the top 3 against the current top 3?"
 *
 * This file is BOTH:
 *   - a pure scoring engine (normalizeBusiness + scoreMarket), reusable for a
 *     future live run, and
 *   - a CLI test harness that scores our 8 saved cities from
 *     scripts/review-velocity-report.json and prints a comparison table.
 *
 * Usage (PowerShell):
 *   node scripts/maps-keyword-difficulty.mjs            # test mode (8 saved cities)
 *   node scripts/maps-keyword-difficulty.mjs --json     # + dump per-city JSON to file
 *
 * Weights sum to 100:
 *   Authority 30 · Reviews 20 · Proximity 15 · Local page 15 · GBP 10 · Brand 10
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// ---------------------------------------------------------------------------
// Tunable config (v4 — tuned against the smell test)
// ---------------------------------------------------------------------------
export const CFG = {
  // bucket weights (total 100). Brand cut 10→5 (franchise strength is already
  // captured by authority + local page); those points moved to Maps-specific
  // proximity (15→18) and local page (15→17).
  authority: { refCap: 1500, blCap: 50000, qDiv: 700, gamma: 1.45, points: 30, wClean: 0.7, wTotal: 0.2, wRank: 0.1 },
  review: { totCap: 6000, velCap: 150, freshDays: 180, wTot: 0.5, wVel: 0.35, wFresh: 0.15, gamma: 1.7, points: 20 },
  proximity: { rMin: 0.5, rCap: 12, points: 18, farMi: 10 },
  localPage: { points: 17, rawMax: 15 },
  gbp: { points: 10 },
  brand: { points: 5, strongRefDoms: 500 }, // strong franchise = franchise & (refDoms>=500 or dedicated page)
  // ranked-incumbent weighting: weakest is the displacement target, middle captures
  // pack depth, strongest gets a small share (locks one slot). No average term.
  agg: { weakest: 0.45, middle: 0.35, strongest: 0.2 },
  // --- post-score modifiers (added to rawScore) ---
  // rank protection: a profile-weak incumbent that Google still ranks #1/#2 has hidden
  // trust (GBP age, entity history, behavioral data) the visible profile can't see, so
  // it's harder to displace than its profile implies. A weak #3 is the clean easy slot.
  rankProtection: { r1: 5, r2: 3 },
  // authority-stretched radius: a far business ranks anyway because it's strong. Tiered by distance.
  stretch: { refDoms: 500, localRefDoms: 100, nearTierRefDoms: 1000, max: 6 },
  // localIncumbentDensityScore: multiple REAL local incumbents in the current 3-pack (no population).
  density: { withinMi: 7, minReviews: 40, max: 8 },
};

const DEFAULT_SERVICE = "junk removal";

const KNOWN_FRANCHISE_DOMAINS = new Set([
  "1800gotjunk.com",
  "gotjunk.com",
  "junk-king.com",
  "junkking.com",
  "junkluggers.com",
  "twomenandajunktruck.com",
  "collegehunkshaulingjunk.com",
]);
const KNOWN_FRANCHISE_NAME = /1-?800-?got-?junk|junk\s*king|junkluggers|two\s+men\s+and\s+a\s+junk|college\s+hunks/i;

// ---------------------------------------------------------------------------
// math helpers
// ---------------------------------------------------------------------------
const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
const avg = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0);
const maxOf = (a) => (a.length ? Math.max(...a) : 0);
const round1 = (x) => Math.round(x * 10) / 10;

/** log-normalize x into 0..1 against a cap, with a gamma to tame the low end. */
function logScale(x, cap, gamma = 1) {
  const v = clamp(Math.log10(1 + Math.max(0, x)) / Math.log10(1 + cap), 0, 1);
  return gamma === 1 ? v : Math.pow(v, gamma);
}

function matchesService(cat, service) {
  if (!cat) return false;
  const c = cat.toLowerCase();
  return service
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => c.includes(t));
}

function isKnownFranchise(domain, name) {
  if (domain && KNOWN_FRANCHISE_DOMAINS.has(domain.toLowerCase())) return true;
  if (name && KNOWN_FRANCHISE_NAME.test(name)) return true;
  return false;
}

/** A "strong brand": a franchise that also has real authority or a dedicated page. */
function isStrongBrand(b) {
  return (
    b.franchise &&
    ((b.dofollowReferringDomains || 0) >= CFG.brand.strongRefDoms || b.hasDedicatedLocalPage)
  );
}

// ---------------------------------------------------------------------------
// Normalizer: report-business (review-velocity-report.json) OR a live-enriched
// business → the flat shape the scorer consumes.
// ---------------------------------------------------------------------------
export function normalizeBusiness(biz, { sharedDomains, service = DEFAULT_SERVICE } = {}) {
  const primaryArr = Array.isArray(biz.gmb?.primaryCategory) ? biz.gmb.primaryCategory : [];
  const landing = biz.landing ?? {};
  const local = landing.onPage ?? null;
  const home = biz.onPage ?? {};
  const domain = biz.domain ?? null;
  return {
    mapsRank: biz.rank,
    name: biz.name,
    placeId: biz.placeId ?? null,
    rating: biz.rating ?? null,
    totalReviews: biz.totalReviews ?? 0,
    reviews30d: biz.reviews30d ?? 0,
    reviews90d: biz.reviews90d ?? 0,
    reviews365d: biz.reviews365d ?? 0,
    daysSinceLastReview: biz.daysSinceLast ?? null,
    lat: biz.lat ?? null,
    lng: biz.lng ?? null,
    distanceMi: biz.distanceMi ?? biz.distanceFromSearchPointMiles ?? null,
    proximityOrder: biz.proximityOrder ?? null,
    website: biz.website ?? biz.gmb?.website ?? null,
    domain,
    dofollowReferringDomains: biz.refDomainsAuthority?.totalDofollowReferringDomains ?? 0,
    refDomainsFetched: biz.refDomainsAuthority?.fetched ?? 0,
    cleanReferringDomains: biz.refDomainsAuthority?.summary?.cleanDomains ?? 0,
    dofollowBacklinks: biz.authority?.totalDofollowCount ?? 0,
    strongestDomainRank: biz.refDomainsAuthority?.summary?.strongestDomainRank ?? 0,
    franchise:
      (domain && sharedDomains?.has(domain)) || isKnownFranchise(domain, biz.name) || false,
    gmbPrimaryCategory: primaryArr[0] ?? null,
    gmbCategories: primaryArr,
    gmbCategoryCount: primaryArr.length,
    gmbPrimaryMatchesService: matchesService(primaryArr[0], service),
    gmbSecondaryMatchesService: primaryArr.slice(1).some((c) => matchesService(c, service)),
    hasHours: !!biz.gmb?.hasHours,
    hasPhone: !!biz.gmb?.phone,
    hasWebsite: !!(biz.website || biz.gmb?.website),
    homeKwInTitle: !!home.kwInTitle,
    homeCityInTitle: !!home.cityInTitle,
    homeKwInH1: !!home.kwInH1,
    homeCityInH1: !!home.cityInH1,
    homeCityInBody: !!home.cityInBody,
    hasDedicatedLocalPage: !!landing.dedicatedLocalPage,
    landingUrl: landing.landingUrl ?? null,
    landingSource: landing.source ?? null,
    local: local
      ? {
          kwInTitle: !!local.kwInTitle,
          cityInTitle: !!local.cityInTitle,
          kwInH1: !!local.kwInH1,
          cityInH1: !!local.cityInH1,
          wordCount: local.wordCount ?? 0,
          title: local.title ?? null,
        }
      : null,
  };
}

// ---------------------------------------------------------------------------
// per-business sub-scores (0..1 unless noted)
// ---------------------------------------------------------------------------
function authorityBusiness(b) {
  const { authority: A } = CFG;
  const total = b.dofollowReferringDomains || 0;
  // Clean referring domains (spam score <= 10). `cleanReferringDomains` is counted
  // over the fetched sample, so scale the clean RATIO up to the full total. If none
  // are clean, authority is near-zero even when raw referring domains exist.
  const cleanEst = b.refDomainsFetched > 0 ? (b.cleanReferringDomains / b.refDomainsFetched) * total : 0;
  const clean = logScale(cleanEst, A.refCap, A.gamma);
  const ref = logScale(total, A.refCap, A.gamma);
  const q = clamp((b.strongestDomainRank || 0) / A.qDiv, 0, 1);
  return A.wClean * clean + A.wTotal * ref + A.wRank * q;
}

function reviewBusiness(b) {
  const { review: R } = CFG;
  const tot = logScale(b.totalReviews, R.totCap, R.gamma);
  const vel = logScale(b.reviews90d, R.velCap, R.gamma);
  const fresh = b.daysSinceLastReview == null ? 0.3 : clamp(1 - b.daysSinceLastReview / R.freshDays, 0, 1);
  return R.wTot * tot + R.wVel * vel + R.wFresh * fresh;
}

/**
 * local-page strength for one business, 0..15 — tiered and strict:
 *   real city+service page (city AND service in title or H1) = high (10-15)
 *   dedicated page with city and service split across title/H1 = 7-8
 *   dedicated but generic service page (no city) = 4-5
 *   homepage that clearly targets city+service = 6-7
 *   homepage with weak city/service relevance = 2-3
 *   nothing local = 1
 */
function localPageBusiness(b) {
  if (b.hasDedicatedLocalPage && b.local) {
    const { cityInTitle: cT, kwInTitle: kT, cityInH1: cH, kwInH1: kH, wordCount } = b.local;
    const words = (wordCount || 0) >= 700;
    if ((cT && kT) || (cH && kH)) {
      // a genuine "{service} {city}" local page
      let s = 10;
      if (cT && kT) s += 2;
      if (cH && kH) s += 1;
      if (words) s += 2;
      return clamp(s, 0, 15);
    }
    if ((cT || cH) && (kT || kH)) return words ? 8 : 7; // city + service, split across title/H1
    if (kT || kH) return words ? 5 : 4; // generic service page, no city
    return 3; // dedicated page, but neither city nor service prominent
  }
  // homepage acting as the local landing page
  const homeCity = b.homeCityInTitle || b.homeCityInH1 || b.homeCityInBody;
  const homeKw = b.homeKwInTitle || b.homeKwInH1;
  if (b.homeCityInTitle && homeKw) return 7; // homepage title targets city + service
  if (homeCity && homeKw) return 5; // city in H1/body + service
  if (homeKw) return 3; // generic service homepage, no city
  if (homeCity) return 2;
  return 1;
}

/** GBP relevance/completeness for one business, 0..10. */
function gbpBusiness(b) {
  let s = 0;
  if (b.gmbPrimaryMatchesService) s += 4;
  if (b.gmbSecondaryMatchesService) s += 2;
  if (b.gmbCategoryCount >= 3) s += 1;
  if (b.hasHours) s += 1;
  if (b.hasPhone) s += 1;
  if (b.hasWebsite) s += 1;
  return clamp(s, 0, 10);
}

// ---------------------------------------------------------------------------
// per-business bucket points (each scaled to its bucket max)
// ---------------------------------------------------------------------------
function perBusinessBuckets(b) {
  return {
    authority: CFG.authority.points * authorityBusiness(b), // 0..30
    reviews: CFG.review.points * reviewBusiness(b), // 0..20
    localPage: localPageBusiness(b) * (CFG.localPage.points / CFG.localPage.rawMax), // 0..17
    gbp: gbpBusiness(b), // 0..10
  };
}

/**
 * Base proximity difficulty from radius tightness only (tight pack = hard).
 * The authority-stretched-radius correction is a SEPARATE additive modifier (below).
 */
function proximityBase(top3) {
  const { proximity: P } = CFG;
  const dists = top3.map((b) => b.distanceMi).filter((d) => d != null);
  if (!dists.length) return { base: P.points * 0.5, maxD: null, medianD: null };
  const maxD = maxOf(dists);
  const sorted = [...dists].sort((a, b) => a - b);
  const medianD = sorted[Math.floor(sorted.length / 2)];
  const base = P.points * clamp((P.rCap - maxD) / (P.rCap - P.rMin), 0, 1);
  return { base, maxD, medianD };
}

/**
 * Authority-stretched-radius boost (max +6), tiered by distance. A far business only
 * "un-easies" the radius if it's strong enough to genuinely reach:
 *   10–15 mi: +2, but ONLY if rank<=2 AND refDoms>=1000 AND dedicated page
 *   15–25 mi: +4 if refDoms>=500 OR strong brand OR (dedicated & refDoms>=100)
 *   25+  mi: +6 (same eligibility as 15–25)
 * Result = the largest tier boost earned by any single incumbent.
 */
function authorityStretchBoost(top3) {
  const { stretch: S, proximity: P } = CFG;
  const generallyStrong = (b) =>
    (b.dofollowReferringDomains || 0) >= S.refDoms ||
    isStrongBrand(b) ||
    (b.hasDedicatedLocalPage && (b.dofollowReferringDomains || 0) >= S.localRefDoms);
  let boost = 0;
  for (const b of top3) {
    const d = b.distanceMi ?? 0;
    if (d < P.farMi || b.mapsRank > 3) continue;
    let t = 0;
    if (d >= 25) t = generallyStrong(b) ? 6 : 0;
    else if (d >= 15) t = generallyStrong(b) ? 4 : 0;
    else if (b.mapsRank <= 2 && (b.dofollowReferringDomains || 0) >= S.nearTierRefDoms && b.hasDedicatedLocalPage) t = 2;
    boost = Math.max(boost, t);
  }
  return Math.min(boost, S.max);
}

/**
 * localIncumbentDensityScore (max 8) — measures whether the current 3-pack is full of
 * REAL local incumbents (no population data). Rewards Woodbridge-type markets where
 * multiple genuine locals compete in the immediate radius.
 */
function localIncumbentDensity(top3) {
  const { density: D } = CFG;
  const dists = top3.map((b) => b.distanceMi).filter((d) => d != null);
  const atLeast2 = (fn) => top3.filter(fn).length >= 2;
  const onPageRelevant = (b) =>
    b.hasDedicatedLocalPage && b.local
      ? (b.local.cityInTitle || b.local.cityInH1) && (b.local.kwInTitle || b.local.kwInH1)
      : (b.homeCityInTitle || b.homeCityInH1 || b.homeCityInBody) && (b.homeKwInTitle || b.homeKwInH1);

  const reasons = [];
  let s = 0;
  if (dists.length === top3.length && maxOf(dists) <= D.withinMi) {
    s += 2;
    reasons.push(`all 3 within ${D.withinMi}mi`);
  }
  if (atLeast2((b) => b.gmbPrimaryMatchesService)) {
    s += 2;
    reasons.push("2+ have target service as primary category");
  }
  if (atLeast2((b) => (b.totalReviews || 0) >= D.minReviews)) {
    s += 2;
    reasons.push(`2+ have ${D.minReviews}+ reviews`);
  }
  if (atLeast2((b) => b.hasWebsite)) {
    s += 1;
    reasons.push("2+ have a real website");
  }
  if (atLeast2(onPageRelevant)) {
    s += 1;
    reasons.push("2+ have city/service on-page relevance");
  }
  return { score: Math.min(s, D.max), reasons };
}

/**
 * Brand difficulty (0..5) — a modest modifier, not a major bucket. Only STRONG
 * franchises count (franchise & (refDoms>=500 or dedicated page)). One franchise
 * barely moves it; real difficulty comes from pack depth.
 */
function brandBucket(top3) {
  const strong = top3.filter(isStrongBrand);
  const byCount = { 0: 0, 1: 1, 2: 3, 3: 5 };
  const pts = byCount[Math.min(strong.length, 3)] ?? 5;
  return { pts, franchiseCount: top3.filter((b) => b.franchise).length, strongBrandCount: strong.length };
}

/**
 * Rank-protection post-score modifier. The displacement target is the weakest incumbent
 * BY PROFILE, but if Google still ranks it #1/#2 it has hidden trust (GBP age, entity
 * history, behavioral/brand signals) the visible profile can't measure — so it's harder
 * to displace than it looks. A weak #3 is the clean easy slot (no protection).
 */
function rankProtection(targetBiz) {
  const { rankProtection: R } = CFG;
  if (targetBiz.mapsRank === 1)
    return { pts: R.r1, reason: `weakest-profile incumbent (${targetBiz.name}) still ranks #1 — hidden trust (GBP age/entity/behavioral) the profile can't see` };
  if (targetBiz.mapsRank === 2)
    return { pts: R.r2, reason: `weakest-profile incumbent (${targetBiz.name}) ranks #2 — some hidden protection beyond its visible profile` };
  return { pts: 0, reason: null };
}

// ---------------------------------------------------------------------------
// labels + narrative
// ---------------------------------------------------------------------------
function difficultyLabel(score) {
  if (score <= 15) return "Very Easy";
  if (score <= 30) return "Easy";
  if (score <= 45) return "Moderate";
  if (score <= 60) return "Hard";
  if (score <= 75) return "Very Hard";
  return "Extreme";
}

function buildReasons(b) {
  const r = [];
  const { authority, reviews, proximity, localPage, brand } = b.bucketScores;
  if (authority >= 21) r.push("Top 3 include very strong link authority (500+ referring domains)");
  else if (authority >= 13) r.push("At least one competitor has solid referring-domain authority");
  else if (authority >= 6) r.push("Top 3 have low-to-moderate authority");
  else r.push("Top 3 have weak authority");

  if (proximity >= 12) r.push("Ranking radius is tight — proximity strongly gates the pack");
  else if (proximity >= 8) r.push("Ranking radius is fairly tight");
  else r.push("Google is reaching far to fill the pack (weaker immediate competition)");

  if (reviews >= 14) r.push("Top 3 include high-review incumbents");
  else if (reviews >= 9) r.push("Top 3 have moderate review prominence");
  else r.push("Top 3 have modest review counts");

  if (brand >= 6) r.push("Multiple national franchises dominate the pack");
  else if (brand >= 3) r.push("A recognizable multi-location brand is present");
  else r.push("No major franchise/entity is dominating the pack");

  if (localPage >= 8) r.push("Competitors run strong dedicated local pages");
  else if (localPage <= 3) r.push("No strong dedicated local pages in the pack");
  return r;
}

function buildWeaknesses(top3) {
  const w = [];
  const r1 = top3.find((b) => b.mapsRank === 1) ?? top3[0];
  if (r1 && (r1.reviews90d || 0) <= 3) w.push("Low review velocity for rank #1");
  top3.forEach((b) => {
    if ((b.dofollowReferringDomains || 0) < 25) w.push(`Low referring domains for rank #${b.mapsRank}`);
  });
  if (!top3.some((b) => b.hasDedicatedLocalPage)) w.push("No strong dedicated local pages");
  if (!top3.some((b) => b.gmbPrimaryMatchesService))
    w.push("No competitor uses the exact target primary category");
  return [...new Set(w)];
}

function buildOpportunities(b, cityLabel) {
  const o = [];
  const { authority, localPage, reviews } = b.bucketScores;
  if (localPage <= 5) o.push(`A strong dedicated ${cityLabel} landing page could differentiate here`);
  if (authority <= 12) o.push("A handful of real local dofollow links could compete on authority");
  if (reviews <= 8) o.push("Steady review growth would clear the pack's review bar");
  if (!o.length) o.push("Market is contested on every signal — needs a well-rounded profile");
  return o;
}

// ---------------------------------------------------------------------------
// Public: score one market from its (already normalized) top-3 businesses.
// ---------------------------------------------------------------------------
export function scoreMarket(top3Norm, { keyword = null, searchPoint = null, cityLabel = "" } = {}) {
  const top3 = top3Norm.slice(0, 3);

  // 1) per-business bucket points, then overall individual strength (per-business buckets only)
  const per = top3.map((b) => {
    const buckets = perBusinessBuckets(b);
    return { b, buckets, individualTotal: buckets.authority + buckets.reviews + buckets.localPage + buckets.gbp };
  });

  // 2) sort competitors ONCE by overall profile strength (weakest→strongest). This is the
  //    displacement ordering: index 0 is the slot you'd actually take. We reuse this single
  //    ordering for every bucket so a truly-weak incumbent (not a per-signal "phantom
  //    weakling") drives the score.
  const ordered = [...per].sort((a, b) => a.individualTotal - b.individualTotal);
  const target = ordered[0];

  // 3) ranked-incumbent blend (0.45 weakest / 0.35 middle / 0.20 strongest) using the
  //    SAME competitor ordering across all buckets.
  const { agg } = CFG;
  const w = [agg.weakest, agg.middle, agg.strongest];
  const at = (i) => ordered[Math.min(i, ordered.length - 1)];
  const blendOrdered = (sel) => w[0] * sel(at(0)) + w[1] * sel(at(1)) + w[2] * sel(at(2));
  const authority = blendOrdered((p) => p.buckets.authority);
  const reviews = blendOrdered((p) => p.buckets.reviews);
  const localPage = blendOrdered((p) => p.buckets.localPage);
  const gbpRelevance = blendOrdered((p) => p.buckets.gbp);

  // 4) pack-level buckets
  const { base: proximity, maxD, medianD } = proximityBase(top3);
  const { pts: brandFranchise, franchiseCount, strongBrandCount } = brandBucket(top3);

  const bucketScores = {
    authority: round1(authority),
    reviews: round1(reviews),
    proximity: round1(proximity),
    localPage: round1(localPage),
    gbpRelevance: round1(gbpRelevance),
    brandFranchise: round1(brandFranchise),
  };
  const rawTotal = authority + reviews + proximity + localPage + gbpRelevance + brandFranchise;

  // --- post-score modifiers ---
  const rankProt = rankProtection(target.b); // {pts 0..5, reason}
  const stretchBoost = authorityStretchBoost(top3); // 0..6
  const density = localIncumbentDensity(top3); // {score 0..8, reasons}

  const rawScore = clamp(Math.round(rawTotal), 0, 100);
  // Modifiers are corrections, not stacking bonuses: scale them by remaining headroom
  // so they lift easy/moderate markets (which need the nuance) but barely move an
  // already-hard pack (which is redundant + would overshoot the 100 scale).
  const modifierNominal = rankProt.pts + stretchBoost + density.score;
  const headroom = 1 - clamp(rawTotal, 0, 100) / 100;
  const modifierApplied = modifierNominal * headroom;
  const mkd = clamp(Math.round(rawTotal + modifierApplied), 0, 100);

  const result = {
    keyword,
    searchPoint,
    cityLabel,
    rawScore,
    rankProtection: rankProt.pts,
    reasonForRankProtection: rankProt.reason,
    authorityStretchedRadiusBoost: stretchBoost,
    localIncumbentDensityScore: density.score,
    localIncumbentDensityReasons: density.reasons,
    modifierNominal: round1(modifierNominal),
    modifierApplied: round1(modifierApplied),
    mapsKeywordDifficulty: mkd,
    difficultyLabel: difficultyLabel(mkd),
    bucketScores,
    radius: { maxDistanceMi: maxD == null ? null : round1(maxD), medianDistanceMi: medianD == null ? null : round1(medianD) },
    franchiseCount,
    strongBrandCount,
    displacementTargetName: target.b.name,
    displacementTargetMapsRank: target.b.mapsRank,
    displacementTargetProfileStrength: round1(target.individualTotal), // 0..77 (per-business buckets)
    displacementTarget: {
      rank: target.b.mapsRank,
      name: target.b.name,
      individualStrength: round1(target.individualTotal),
    },
    top3Summary: per.map((p) => ({
      rank: p.b.mapsRank,
      name: p.b.name,
      individualStrength: round1(p.individualTotal), // 0..75
      isDisplacementTarget: p === target,
      distanceMi: p.b.distanceMi,
      reviews90d: p.b.reviews90d,
      totalReviews: p.b.totalReviews,
      dofollowReferringDomains: p.b.dofollowReferringDomains,
      hasDedicatedLocalPage: p.b.hasDedicatedLocalPage,
      gmbPrimaryCategory: p.b.gmbPrimaryCategory,
      franchise: p.b.franchise,
    })),
  };
  result.mainReasons = buildReasons(result);
  result.weakestSignalsInTop3 = buildWeaknesses(top3);
  result.opportunityNotes = buildOpportunities(result, cityLabel || "local");
  return result;
}

// ---------------------------------------------------------------------------
// Test harness — score the 8 saved cities from review-velocity-report.json
// ---------------------------------------------------------------------------
function loadReport() {
  return JSON.parse(readFileSync(resolve(ROOT, "scripts/review-velocity-report.json"), "utf8"));
}

function computeSharedDomains(report) {
  const counts = new Map();
  for (const city of report.report)
    for (const b of city.businesses ?? [])
      if (b.domain) counts.set(b.domain, (counts.get(b.domain) ?? 0) + 1);
  return new Set([...counts.entries()].filter(([, n]) => n > 1).map(([d]) => d));
}

function cityShort(label) {
  return label.split(",")[0].replace(/\(.*\)/, "").trim();
}

function pad(s, n, right = false) {
  s = String(s);
  return right ? s.padStart(n) : s.padEnd(n);
}

function runTestMode({ dumpJson }) {
  const report = loadReport();
  const sharedDomains = computeSharedDomains(report);
  const results = [];

  for (const city of report.report) {
    const label = cityShort(city.label);
    const top3 = (city.businesses ?? [])
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .slice(0, 3)
      .map((b) => normalizeBusiness(b, { sharedDomains }));
    const res = scoreMarket(top3, {
      keyword: city.query ?? null,
      searchPoint: city.searchPoint ?? null,
      cityLabel: label,
    });
    results.push(res);
  }

  // comparison table
  const headers = ["City", "Raw", "+Rk", "+St", "+De", "MKD", "Label", "Auth", "Rev", "Prox", "Local", "GBP", "Brd", "Weakest incumbent (bar)"];
  const widths = [12, 4, 4, 4, 4, 4, 10, 6, 5, 5, 6, 5, 4, 26];
  console.log("\n" + "=".repeat(108));
  console.log("MAPS KEYWORD DIFFICULTY — v4 (test mode, 8 saved cities)");
  console.log("=".repeat(108));
  const dash = (n) => (n ? `+${n}` : "-");
  console.log(headers.map((h, i) => pad(h, widths[i], i >= 1 && i <= 12)).join(" "));
  console.log("-".repeat(116));
  for (const r of results) {
    const b = r.bucketScores;
    const bar = `#${r.displacementTarget.rank} ${r.displacementTarget.name} (${r.displacementTarget.individualStrength})`;
    const row = [
      pad(r.cityLabel, widths[0]),
      pad(r.rawScore, widths[1], true),
      pad(dash(r.rankProtection), widths[2], true),
      pad(dash(r.authorityStretchedRadiusBoost), widths[3], true),
      pad(dash(r.localIncumbentDensityScore), widths[4], true),
      pad(r.mapsKeywordDifficulty, widths[5], true),
      pad(r.difficultyLabel, widths[6]),
      pad(b.authority, widths[7], true),
      pad(b.reviews, widths[8], true),
      pad(b.proximity, widths[9], true),
      pad(b.localPage, widths[10], true),
      pad(b.gbpRelevance, widths[11], true),
      pad(b.brandFranchise, widths[12], true),
      pad(bar.slice(0, widths[13]), widths[13]),
    ];
    console.log(row.join(" "));
  }
  console.log("-".repeat(116));
  console.log("Labels: 0-15 Very Easy · 16-30 Easy · 31-45 Moderate · 46-60 Hard · 61-75 Very Hard · 76-100 Extreme");
  console.log("+Rk rank-protection (weak-profile incumbent still ranks #1/#2) · +St authority-stretched-radius · +De local-incumbent-density (nominal; MKD scales them by headroom so hard packs don't overshoot)");

  // expected calibration reminder
  const expected = {
    Woodbridge: "Easy–Moderate",
    Winchester: "Moderate",
    Baltimore: "Very Hard",
    Miami: "Hard–Very Hard",
    "Los Angeles": "Very Hard–Extreme",
    Denver: "Very Hard",
    Nashville: "Very Hard",
    Phoenix: "Very Hard",
  };
  console.log("\nExpected (smell test):");
  for (const r of results) {
    const exp = expected[r.cityLabel] ?? "?";
    console.log(`  ${pad(r.cityLabel, 12)} got ${pad(r.difficultyLabel, 11)} (${r.mapsKeywordDifficulty})  vs expected ${exp}`);
  }

  if (dumpJson) {
    const out = resolve(ROOT, "scripts/maps-keyword-difficulty-test.json");
    writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), config: CFG, results }, null, 2));
    console.log(`\nWrote per-city detail → ${out}`);
  }
  return results;
}

// ---------------------------------------------------------------------------
// entry
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);
if (args.includes("--help")) {
  console.log("node scripts/maps-keyword-difficulty.mjs [--json]\n  (test mode scores the 8 saved cities; live mode wiring is the next step)");
} else {
  runTestMode({ dumpJson: args.includes("--json") });
}
