/**
 * Maps Keyword Difficulty (MKD) — v6 scoring engine.
 *
 *   Maps Keyword Difficulty = how hard it is to break INTO the 3-pack,
 *   NOT how hard it is to become #1.
 *
 * v6 mechanics:
 *   - table-stakes signals (proximity, local page, GBP) capped at 15 total — not 45.
 *   - competitive signals carry weight: authority, reviews, and incumbent strength.
 *   - competitors sorted ONCE by profile strength; ranked-incumbent blend for authority/local/GBP.
 *   - reviews: ~68% volume + ~27% 90d velocity (+ small fresh/rating).
 *   - incumbent strength replaces v4 post-score modifiers (no headroom scaling).
 */

import { authorityStrengthLabel, rootSupportedAuthorityNote } from "@/lib/maps-difficulty/authority";

// ---------------------------------------------------------------------------
// Tunable config (v6)
// ---------------------------------------------------------------------------
export const CFG = {
  authority: { refCap: 1500, blCap: 50000, qDiv: 700, gamma: 1.45, points: 30, wClean: 0.7, wTotal: 0.2, wRank: 0.1 },
  review: {
    velCap: 150,
    freshDays: 180,
    points: 22,
    highCap: 25000,
    highGamma: 1.15,
    wVolume: 0.68,
    wVelocity: 0.27,
    wFresh: 0.03,
    wRating: 0.02,
  },
  incumbentStrength: { points: 12, clusterMi: 5 },
  proximity: { rMin: 0.5, rCap: 12, points: 6 },
  localPage: { points: 5 },
  gbp: { points: 4 },
  brand: { points: 3, strongRefDoms: 500 },
  agg: { weakest: 0.45, middle: 0.35, strongest: 0.2 },
} as const;

export const BUCKET_MAX = {
  authority: CFG.authority.points,
  reviews: CFG.review.points,
  incumbentStrength: CFG.incumbentStrength.points,
  proximity: CFG.proximity.points,
  localPage: CFG.localPage.points,
  gbpRelevance: CFG.gbp.points,
  brandFranchise: CFG.brand.points,
} as const;

/** Max per-business profile points used for displacement-target ordering. */
export const PROFILE_STRENGTH_MAX =
  CFG.authority.points + CFG.review.points + CFG.localPage.points + CFG.gbp.points;

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
// types
// ---------------------------------------------------------------------------
export interface EnrichedLocalPage {
  ok?: boolean;
  kwInTitle?: boolean;
  cityInTitle?: boolean;
  kwInH1?: boolean;
  cityInH1?: boolean;
  wordCount?: number | null;
  title?: string | null;
}

/** The report-business shape produced by the enrichment pipeline. */
export interface EnrichedBusiness {
  rank: number;
  name: string;
  placeId?: string | null;
  rating?: number | null;
  totalReviews?: number | null;
  reviews30d?: number;
  reviews90d?: number;
  reviews365d?: number;
  daysSinceLast?: number | null;
  lat?: number | null;
  lng?: number | null;
  distanceMi?: number | null;
  distanceFromSearchPointMiles?: number | null;
  proximityOrder?: number | null;
  website?: string | null;
  domain?: string | null;
  refDomainsAuthority?: {
    totalDofollowReferringDomains?: number;
    fetched?: number;
    summary?: { cleanDomains?: number; strongestDomainRank?: number | null } | null;
    error?: string;
  } | null;
  authority?: import("@/lib/maps-difficulty/authority").CompetitorAuthority | null;
  /** @deprecated legacy field — not populated by live enrich */
  authorityLegacy?: { totalDofollowCount?: number | null } | null;
  gmb?: {
    primaryCategory?: string[] | string | null;
    categories?: string[];
    hasHours?: boolean;
    phone?: string | null;
    website?: string | null;
    error?: string;
  } | null;
  onPage?: {
    ok?: boolean;
    kwInTitle?: boolean;
    cityInTitle?: boolean;
    kwInH1?: boolean;
    cityInH1?: boolean;
    cityInBody?: boolean;
  } | null;
  landing?: {
    dedicatedLocalPage?: boolean;
    landingUrl?: string | null;
    source?: string | null;
    onPage?: EnrichedLocalPage | null;
  } | null;
}

export interface NormalizedBusiness {
  mapsRank: number;
  name: string;
  placeId: string | null;
  rating: number | null;
  totalReviews: number;
  reviews30d: number;
  reviews90d: number;
  reviews365d: number;
  daysSinceLastReview: number | null;
  lat: number | null;
  lng: number | null;
  distanceMi: number | null;
  proximityOrder: number | null;
  website: string | null;
  domain: string | null;
  dofollowReferringDomains: number;
  refDomainsFetched: number;
  cleanReferringDomains: number;
  dofollowBacklinks: number;
  strongestDomainRank: number;
  pageTargetUrl: string | null;
  rootDomain: string | null;
  pageCleanDofollowRefDomains: number;
  rootCleanDofollowRefDomains: number;
  pageAuthorityScore: number;
  rootAuthorityScore: number;
  combinedAuthorityScore: number;
  authoritySourceType: "page_and_root" | "root_only" | null;
  usedSameTargetForPageAndRoot: boolean;
  authorityStrengthLabel: string;
  authorityNote: string | null;
  franchise: boolean;
  gmbPrimaryCategory: string | null;
  gmbCategories: string[];
  gmbCategoryCount: number;
  gmbPrimaryMatchesService: boolean;
  gmbSecondaryMatchesService: boolean;
  hasHours: boolean;
  hasPhone: boolean;
  hasWebsite: boolean;
  homeKwInTitle: boolean;
  homeCityInTitle: boolean;
  homeKwInH1: boolean;
  homeCityInH1: boolean;
  homeCityInBody: boolean;
  hasDedicatedLocalPage: boolean;
  landingUrl: string | null;
  landingSource: string | null;
  local: {
    kwInTitle: boolean;
    cityInTitle: boolean;
    kwInH1: boolean;
    cityInH1: boolean;
    wordCount: number;
    title: string | null;
  } | null;
}

export interface BucketScores {
  authority: number;
  reviews: number;
  incumbentStrength: number;
  proximity: number;
  localPage: number;
  gbpRelevance: number;
  brandFranchise: number;
}

export type LocalPageTier =
  | "dedicated-local"
  | "generic-service"
  | "homepage-local"
  | "weak-homepage"
  | "none";
export type ProfileOrder = "weakest" | "middle" | "strongest";

export interface Top3SummaryRow {
  rank: number;
  name: string;
  individualStrength: number;
  profileOrder: ProfileOrder;
  isDisplacementTarget: boolean;
  distanceMi: number | null;
  reviews90d: number;
  totalReviews: number;
  dofollowReferringDomains: number;
  pageCleanDofollowRefDomains: number;
  rootCleanDofollowRefDomains: number;
  combinedAuthorityScore: number;
  authorityStrengthLabel: string;
  authorityNote: string | null;
  usedSameTargetForPageAndRoot: boolean;
  hasDedicatedLocalPage: boolean;
  localPageTier: LocalPageTier;
  gmbPrimaryCategory: string | null;
  franchise: boolean;
}

export interface MarketScore {
  keyword: string | null;
  searchPoint: { lat: number; lng: number } | null;
  cityLabel: string;
  scoreIntent: "break_into_top_3";
  rawScore: number;
  /** @deprecated v6 — folded into incumbentStrength bucket; always 0 */
  rankProtection: number;
  reasonForRankProtection: string | null;
  /** @deprecated v6 — always 0 */
  authorityStretchedRadiusBoost: number;
  /** @deprecated v6 — folded into incumbentStrength; always 0 */
  localIncumbentDensityScore: number;
  /** @deprecated v6 */
  localIncumbentDensityReasons: string[];
  /** @deprecated v6 — no headroom modifiers */
  modifierNominal: number;
  /** @deprecated v6 — no headroom modifiers */
  modifierApplied: number;
  mapsKeywordDifficulty: number;
  difficultyLabel: string;
  bucketScores: BucketScores;
  incumbentStrengthReasons: string[];
  radius: { maxDistanceMi: number | null; medianDistanceMi: number | null };
  franchiseCount: number;
  strongBrandCount: number;
  displacementTargetName: string;
  displacementTargetMapsRank: number;
  displacementTargetProfileStrength: number;
  displacementTarget: { rank: number; name: string; individualStrength: number };
  top3Summary: Top3SummaryRow[];
  mainReasons: string[];
  weakestSignalsInTop3: string[];
  opportunityNotes: string[];
}

// ---------------------------------------------------------------------------
// math helpers
// ---------------------------------------------------------------------------
const clamp = (x: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, x));
const maxOf = (a: number[]) => (a.length ? Math.max(...a) : 0);
const round1 = (x: number) => Math.round(x * 10) / 10;

/** log-normalize x into 0..1 against a cap, with a gamma to tame the low end. */
function logScale(x: number, cap: number, gamma = 1): number {
  const v = clamp(Math.log10(1 + Math.max(0, x)) / Math.log10(1 + cap), 0, 1);
  return gamma === 1 ? v : Math.pow(v, gamma);
}

function matchesService(cat: string | null | undefined, service: string): boolean {
  if (!cat) return false;
  const c = cat.toLowerCase();
  return service
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((t) => c.includes(t));
}

function isKnownFranchise(domain: string | null, name: string | null): boolean {
  if (domain && KNOWN_FRANCHISE_DOMAINS.has(domain.toLowerCase())) return true;
  if (name && KNOWN_FRANCHISE_NAME.test(name)) return true;
  return false;
}

/** A "strong brand": a franchise that also has real authority or a dedicated page. */
function isStrongBrand(b: NormalizedBusiness): boolean {
  const refSignal = Math.max(b.rootCleanDofollowRefDomains, b.pageCleanDofollowRefDomains, b.dofollowReferringDomains || 0);
  return b.franchise && (refSignal >= CFG.brand.strongRefDoms || b.hasDedicatedLocalPage);
}

// ---------------------------------------------------------------------------
// Normalizer: enriched report-business -> the flat shape the scorer consumes.
// ---------------------------------------------------------------------------
export function normalizeBusiness(
  biz: EnrichedBusiness,
  { sharedDomains, service = DEFAULT_SERVICE }: { sharedDomains?: Set<string>; service?: string } = {}
): NormalizedBusiness {
  const gmb = biz.gmb ?? {};
  const primaryArr: string[] = Array.isArray(gmb.primaryCategory)
    ? gmb.primaryCategory
    : Array.isArray(gmb.categories) && gmb.categories.length
      ? gmb.categories
      : typeof gmb.primaryCategory === "string" && gmb.primaryCategory
        ? [gmb.primaryCategory]
        : [];
  const landing = biz.landing ?? {};
  const local = landing.onPage ?? null;
  const home = biz.onPage ?? {};
  const domain = biz.domain ?? null;
  const auth = biz.authority ?? null;
  const rootRef = biz.refDomainsAuthority;
  const effectiveRefDomains = auth?.rootDofollowRefDomains ?? rootRef?.totalDofollowReferringDomains ?? 0;
  const effectiveClean = auth?.rootCleanDofollowRefDomains ?? rootRef?.summary?.cleanDomains ?? 0;
  const effectiveFetched = rootRef?.fetched ?? 0;
  const combinedScore =
    auth?.combinedAuthorityScore ??
    (rootRef && !rootRef.error
      ? refDomainAuthorityScore({
          totalDofollowReferringDomains: rootRef.totalDofollowReferringDomains,
          fetched: rootRef.fetched,
          summary: rootRef.summary,
        })
      : 0);
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
    dofollowReferringDomains: effectiveRefDomains,
    refDomainsFetched: effectiveFetched,
    cleanReferringDomains: effectiveClean,
    dofollowBacklinks: biz.authorityLegacy?.totalDofollowCount ?? 0,
    strongestDomainRank: auth?.rootStrongestReferringDomainRank ?? rootRef?.summary?.strongestDomainRank ?? 0,
    pageTargetUrl: auth?.pageTargetUrl ?? biz.landing?.landingUrl ?? biz.website ?? null,
    rootDomain: auth?.rootDomain ?? domain,
    pageCleanDofollowRefDomains: auth?.pageCleanDofollowRefDomains ?? 0,
    rootCleanDofollowRefDomains: auth?.rootCleanDofollowRefDomains ?? effectiveClean,
    pageAuthorityScore: auth?.pageAuthorityScore ?? 0,
    rootAuthorityScore: auth?.rootAuthorityScore ?? 0,
    combinedAuthorityScore: combinedScore,
    authoritySourceType: auth?.authoritySourceType ?? null,
    usedSameTargetForPageAndRoot: auth?.usedSameTargetForPageAndRoot ?? true,
    authorityStrengthLabel: authorityStrengthLabel(combinedScore),
    authorityNote: rootSupportedAuthorityNote(auth),
    franchise: (domain != null && (sharedDomains?.has(domain) ?? false)) || isKnownFranchise(domain, biz.name) || false,
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
/** Score 0..1 from referring-domain metrics (page or root target). */
export function refDomainAuthorityScore(ref: {
  totalDofollowReferringDomains?: number;
  fetched?: number;
  summary?: { cleanDomains?: number; strongestDomainRank?: number | null } | null;
}): number {
  const A = CFG.authority;
  const total = ref.totalDofollowReferringDomains || 0;
  const fetched = ref.fetched || 0;
  const cleanDomains = ref.summary?.cleanDomains ?? 0;
  const cleanEst = fetched > 0 ? (cleanDomains / fetched) * total : 0;
  const clean = logScale(cleanEst, A.refCap, A.gamma);
  const refScaled = logScale(total, A.refCap, A.gamma);
  const q = clamp((ref.summary?.strongestDomainRank || 0) / A.qDiv, 0, 1);
  return A.wClean * clean + A.wTotal * refScaled + A.wRank * q;
}

function authorityBusiness(b: NormalizedBusiness): number {
  if (b.authoritySourceType != null) return b.combinedAuthorityScore;
  // Legacy runs without page+root authority profile — root-only fallback
  return refDomainAuthorityScore({
    totalDofollowReferringDomains: b.dofollowReferringDomains,
    fetched: b.refDomainsFetched,
    summary: { cleanDomains: b.cleanReferringDomains, strongestDomainRank: b.strongestDomainRank },
  });
}

/** Review volume 0..1 from total review count (log scale above 150). */
function reviewVolumeNorm(total: number): number {
  const R = CFG.review;
  if (total <= 10) return (total / 10) * 0.1;
  if (total <= 30) return 0.1 + ((total - 10) / 20) * 0.13;
  if (total <= 75) return 0.23 + ((total - 30) / 45) * 0.17;
  if (total <= 150) return 0.4 + ((total - 75) / 75) * 0.23;
  return 0.63 + logScale(total - 150, R.highCap, R.highGamma) * 0.37;
}

/** Per-business review strength: ~68% volume, ~27% 90d velocity, small fresh/rating. */
function reviewStrengthNorm(b: NormalizedBusiness): number {
  const R = CFG.review;
  const volume = reviewVolumeNorm(b.totalReviews);
  const velocity = logScale(b.reviews90d, R.velCap, 2);
  const fresh =
    b.daysSinceLastReview == null ? 0.5 : clamp(1 - b.daysSinceLastReview / R.freshDays, 0, 1);
  const rating =
    b.rating != null && b.rating >= 4.5 ? 1 : b.rating != null && b.rating >= 4.0 ? 0.5 : 0;
  return clamp(
    R.wVolume * volume + R.wVelocity * velocity + R.wFresh * fresh + R.wRating * rating,
    0,
    1
  );
}

/** Pack-level reviews bucket — median-heavy blend (v6 max 22). */
function reviewsBucket(top3: NormalizedBusiness[]): number {
  const scores = top3.map(reviewStrengthNorm).sort((a, b) => a - b);
  const median = scores[Math.floor(scores.length / 2)] ?? 0;
  const avg = scores.length ? scores.reduce((s, x) => s + x, 0) / scores.length : 0;
  let pack = 0.6 * median + 0.4 * avg;

  const max = maxOf(scores);
  if (scores.length >= 2 && max > 0.75 && median < 0.45 && max > median * 2.2) {
    pack = Math.min(pack, 0.6 * median + 0.4 * avg * 0.9);
  }
  return clamp(pack, 0, 1) * CFG.review.points;
}

function onPageRelevant(b: NormalizedBusiness): boolean {
  if (b.hasDedicatedLocalPage && b.local) {
    return (
      (b.local.cityInTitle || b.local.cityInH1) && (b.local.kwInTitle || b.local.kwInH1)
    );
  }
  return (
    (b.homeCityInTitle || b.homeCityInH1 || b.homeCityInBody) &&
    (b.homeKwInTitle || b.homeKwInH1)
  );
}

/** Local-page strength 0..5 — website presence is table stakes, not a moat. */
function localPageBusiness(b: NormalizedBusiness): number {
  if (!b.hasWebsite) return 0;
  const tier = localPageTier(b);
  const scores: Record<LocalPageTier, number> = {
    none: 0.4,
    "weak-homepage": 1,
    "homepage-local": 2.2,
    "generic-service": 3.2,
    "dedicated-local":
      b.local?.cityInTitle && b.local?.kwInTitle && b.local?.cityInH1 && b.local?.kwInH1 ? 4.8 : 3.8,
  };
  return clamp(scores[tier] ?? 0, 0, CFG.localPage.points);
}

/** Human-readable local-page tier (mirrors the tiers in localPageBusiness). */
export function localPageTier(b: NormalizedBusiness): LocalPageTier {
  if (b.hasDedicatedLocalPage && b.local) {
    const city = b.local.cityInTitle || b.local.cityInH1;
    const kw = b.local.kwInTitle || b.local.kwInH1;
    if (city && kw) return "dedicated-local"; // dedicated city/service page
    return "generic-service"; // dedicated page, but weak city targeting
  }
  const homeCity = b.homeCityInTitle || b.homeCityInH1 || b.homeCityInBody;
  const homeKw = b.homeKwInTitle || b.homeKwInH1;
  if (homeCity && homeKw) return "homepage-local"; // homepage functions as the local landing page
  if (homeCity || homeKw) return "weak-homepage"; // homepage fallback with weak local relevance
  return "none"; // no useful indexed landing page found
}

/** GBP alignment 0..4 — scores intent match, not profile completeness. */
function gbpBusiness(b: NormalizedBusiness): number {
  let s = 0;
  if (b.gmbPrimaryCategory) s += 0.3;
  if (b.gmbPrimaryMatchesService) s += 1.5;
  else if (b.gmbSecondaryMatchesService) s += 0.8;
  if (b.gmbPrimaryMatchesService && onPageRelevant(b)) s += 1.5;
  if (
    b.gmbPrimaryMatchesService &&
    b.hasDedicatedLocalPage &&
    b.local?.kwInTitle &&
    b.local?.cityInTitle
  ) {
    s += 0.7;
  }
  return clamp(s, 0, CFG.gbp.points);
}

interface PerBusinessBuckets {
  authority: number;
  reviews: number;
  localPage: number;
  gbp: number;
}

function perBusinessBuckets(b: NormalizedBusiness): PerBusinessBuckets {
  return {
    authority: CFG.authority.points * authorityBusiness(b),
    reviews: CFG.review.points * reviewStrengthNorm(b),
    localPage: localPageBusiness(b),
    gbp: gbpBusiness(b),
  };
}

// ---------------------------------------------------------------------------
// pack-level buckets + modifiers
// ---------------------------------------------------------------------------
function proximityBase(top3: NormalizedBusiness[]): { base: number; maxD: number | null; medianD: number | null } {
  const P = CFG.proximity;
  const dists = top3.map((b) => b.distanceMi).filter((d): d is number => d != null);
  if (!dists.length) return { base: P.points * 0.25, maxD: null, medianD: null };
  const maxD = maxOf(dists);
  const sorted = [...dists].sort((a, b) => a - b);
  const medianD = sorted[Math.floor(sorted.length / 2)];
  const tightness = clamp((P.rCap - maxD) / (P.rCap - P.rMin), 0, 1);
  const base = P.points * Math.pow(tightness, 1.15);
  return { base, maxD, medianD };
}

function strongAuthority(b: NormalizedBusiness): boolean {
  const refSignal = Math.max(
    b.rootCleanDofollowRefDomains,
    b.pageCleanDofollowRefDomains,
    b.dofollowReferringDomains || 0
  );
  return b.combinedAuthorityScore >= 0.35 || refSignal >= 50;
}

function incumbentStrengthBucket(
  top3: NormalizedBusiness[],
  targetBiz: NormalizedBusiness
): { score: number; reasons: string[] } {
  const I = CFG.incumbentStrength;
  const reasons: string[] = [];
  let s = 0;
  const atLeast2 = (fn: (b: NormalizedBusiness) => boolean) => top3.filter(fn).length >= 2;

  if (atLeast2((b) => b.totalReviews >= 50)) {
    s += 1;
    reasons.push("2+ top-3 with 50+ reviews");
  }
  if (atLeast2((b) => b.totalReviews >= 150)) {
    s += 1;
    reasons.push("2+ top-3 with 150+ reviews");
  }
  if (atLeast2((b) => b.totalReviews >= 300)) {
    s += 1;
    reasons.push("2+ top-3 with 300+ reviews");
  }
  if (atLeast2((b) => b.gmbPrimaryMatchesService && onPageRelevant(b))) {
    s += 2;
    reasons.push("2+ top-3 with category + on-page alignment");
  }
  const dists = top3.map((b) => b.distanceMi).filter((d): d is number => d != null);
  if (dists.length === top3.length && maxOf(dists) <= I.clusterMi) {
    s += 2;
    reasons.push(`top 3 clustered within ${I.clusterMi}mi of pin`);
  }
  if (top3.some(strongAuthority)) {
    s += 2;
    reasons.push("1+ top-3 with strong authority/root-domain support");
  }
  if (top3.some((b) => b.franchise)) {
    s += 1;
    reasons.push("franchise/brand competitor in pack");
  }
  if (targetBiz.mapsRank <= 2) {
    s += 2;
    reasons.push(
      `weakest-profile incumbent (${targetBiz.name}) still ranks #${targetBiz.mapsRank} — hidden trust beyond visible profile`
    );
  }

  return { score: Math.min(s, I.points), reasons };
}

function brandBucket(top3: NormalizedBusiness[]): { pts: number; franchiseCount: number; strongBrandCount: number } {
  const franchiseCount = top3.filter((b) => b.franchise).length;
  const strong = top3.filter(isStrongBrand);
  let pts = 0;
  if (franchiseCount > 0) pts = 1;
  if (strong.length >= 2) pts = 2;
  if (strong.length >= 3) pts = CFG.brand.points;
  return { pts, franchiseCount, strongBrandCount: strong.length };
}

// ---------------------------------------------------------------------------
// labels + narrative
// ---------------------------------------------------------------------------
export function difficultyLabel(score: number): string {
  if (score <= 10) return "Ultra Easy";
  if (score <= 20) return "Very Easy";
  if (score <= 35) return "Easy";
  if (score <= 50) return "Moderate";
  if (score <= 65) return "Hard";
  if (score <= 80) return "Very Hard";
  return "Brutal";
}

function buildReasons(bucketScores: BucketScores, top3: NormalizedBusiness[]): string[] {
  const r: string[] = [];
  const { authority, reviews, proximity, localPage, brandFranchise: brand, incumbentStrength } =
    bucketScores;

  if (authority >= 21) r.push("Top 3 include very strong link authority (strong page and/or root-domain signals)");
  else if (authority >= 13) r.push("At least one competitor has solid referring-domain authority");
  else if (authority >= 6) r.push("Top 3 have low-to-moderate authority");
  else r.push("Top 3 have weak authority");

  const rootSupported = top3.some(
    (b) =>
      !b.usedSameTargetForPageAndRoot &&
      b.pageCleanDofollowRefDomains < 15 &&
      b.rootCleanDofollowRefDomains >= 50
  );
  if (rootSupported && authority >= 6) {
    r.push(
      "Authority pressure is partly from root domains — ranking pages have limited page-level links, but one or more competitors are supported by stronger root domains"
    );
  }

  if (incumbentStrength >= 8) r.push("Top 3 incumbents are well protected on multiple signals");
  else if (incumbentStrength >= 4) r.push("Some incumbent protection in the current pack");

  if (proximity >= 4.5) r.push("Ranking radius is tight — proximity gates the pack");
  else if (proximity >= 2.5) r.push("Ranking radius is moderately tight");
  else r.push("Pack radius is fairly wide — proximity is not the main gate");

  if (reviews >= 16) r.push("Top 3 include high-review incumbents");
  else if (reviews >= 10) r.push("Top 3 have moderate review prominence");
  else r.push("Top 3 have modest review counts");

  if (brand >= 2) r.push("A recognizable multi-location brand is present");
  else r.push("No major franchise/entity is dominating the pack");

  if (localPage >= 3) r.push("Competitors run meaningful local landing pages");
  else if (localPage <= 1) r.push("No strong dedicated local pages in the pack");
  return r;
}

function buildWeaknesses(top3: NormalizedBusiness[]): string[] {
  const w: string[] = [];
  const r1 = top3.find((b) => b.mapsRank === 1) ?? top3[0];
  if (r1 && (r1.reviews90d || 0) <= 3) w.push("Low review velocity for rank #1");
  top3.forEach((b) => {
    const pageClean = b.pageCleanDofollowRefDomains;
    const rootClean = b.rootCleanDofollowRefDomains;
    if (pageClean < 10 && rootClean < 25) {
      w.push(`Low page and root authority for rank #${b.mapsRank}`);
    } else if (!b.usedSameTargetForPageAndRoot && pageClean < 10 && rootClean >= 25) {
      w.push(`Weak local-page links for rank #${b.mapsRank} (root domain is stronger)`);
    } else if (pageClean < 25) {
      w.push(`Low referring domains for rank #${b.mapsRank}`);
    }
  });
  if (!top3.some((b) => b.hasDedicatedLocalPage)) w.push("No strong dedicated local pages");
  if (!top3.some((b) => b.gmbPrimaryMatchesService)) w.push("No competitor uses the exact target primary category");
  return [...new Set(w)];
}

function buildOpportunities(bucketScores: BucketScores, cityLabel: string): string[] {
  const o: string[] = [];
  const { authority, localPage, reviews } = bucketScores;
  if (localPage <= 2) o.push(`A strong dedicated ${cityLabel} landing page could differentiate here`);
  if (authority <= 12) o.push("A handful of real local dofollow links could compete on authority");
  if (reviews <= 10) o.push("Steady review growth would clear the pack's review bar");
  if (!o.length) o.push("Market is contested on every signal — needs a well-rounded profile");
  return o;
}

// ---------------------------------------------------------------------------
// Public: score one market from its (already normalized) top-3 businesses.
// ---------------------------------------------------------------------------
export function scoreMarket(
  top3Norm: NormalizedBusiness[],
  {
    keyword = null,
    searchPoint = null,
    cityLabel = "",
  }: {
    keyword?: string | null;
    searchPoint?: { lat: number; lng: number } | null;
    cityLabel?: string;
  } = {}
): MarketScore {
  const top3 = top3Norm.slice(0, 3);

  const per = top3.map((b) => {
    const buckets = perBusinessBuckets(b);
    return { b, buckets, individualTotal: buckets.authority + buckets.reviews + buckets.localPage + buckets.gbp };
  });

  const ordered = [...per].sort((a, b) => a.individualTotal - b.individualTotal);
  const target = ordered[0];
  const profileOrderOf = (p: (typeof per)[number]): ProfileOrder => {
    const idx = ordered.indexOf(p);
    if (ordered.length <= 1) return "weakest";
    if (idx === 0) return "weakest";
    if (idx === ordered.length - 1) return "strongest";
    return "middle";
  };

  const w = [CFG.agg.weakest, CFG.agg.middle, CFG.agg.strongest];
  const at = (i: number) => ordered[Math.min(i, ordered.length - 1)];
  const blendOrdered = (sel: (p: (typeof per)[number]) => number) =>
    w[0] * sel(at(0)) + w[1] * sel(at(1)) + w[2] * sel(at(2));
  const authority = blendOrdered((p) => p.buckets.authority);
  const localPage = blendOrdered((p) => p.buckets.localPage);
  const gbpRelevance = blendOrdered((p) => p.buckets.gbp);

  const reviews = reviewsBucket(top3);
  const { base: proximity, maxD, medianD } = proximityBase(top3);
  const { pts: brandFranchise, franchiseCount, strongBrandCount } = brandBucket(top3);
  const incumbent = incumbentStrengthBucket(top3, target.b);
  const rankProtReason =
    target.b.mapsRank <= 2
      ? incumbent.reasons.find((r) => r.includes("weakest-profile")) ?? null
      : null;

  const bucketScores: BucketScores = {
    authority: round1(authority),
    reviews: round1(reviews),
    incumbentStrength: round1(incumbent.score),
    proximity: round1(proximity),
    localPage: round1(localPage),
    gbpRelevance: round1(gbpRelevance),
    brandFranchise: round1(brandFranchise),
  };
  const rawTotal =
    authority + reviews + incumbent.score + proximity + localPage + gbpRelevance + brandFranchise;
  const mkd = clamp(Math.round(rawTotal), 0, 100);

  return {
    keyword,
    searchPoint,
    cityLabel,
    scoreIntent: "break_into_top_3",
    rawScore: mkd,
    rankProtection: 0,
    reasonForRankProtection: rankProtReason,
    authorityStretchedRadiusBoost: 0,
    localIncumbentDensityScore: 0,
    localIncumbentDensityReasons: [],
    modifierNominal: 0,
    modifierApplied: 0,
    mapsKeywordDifficulty: mkd,
    difficultyLabel: difficultyLabel(mkd),
    bucketScores,
    incumbentStrengthReasons: incumbent.reasons,
    radius: { maxDistanceMi: maxD == null ? null : round1(maxD), medianDistanceMi: medianD == null ? null : round1(medianD) },
    franchiseCount,
    strongBrandCount,
    displacementTargetName: target.b.name,
    displacementTargetMapsRank: target.b.mapsRank,
    displacementTargetProfileStrength: round1(target.individualTotal),
    displacementTarget: { rank: target.b.mapsRank, name: target.b.name, individualStrength: round1(target.individualTotal) },
    top3Summary: per.map((p) => ({
      rank: p.b.mapsRank,
      name: p.b.name,
      individualStrength: round1(p.individualTotal),
      profileOrder: profileOrderOf(p),
      isDisplacementTarget: p === target,
      distanceMi: p.b.distanceMi,
      reviews90d: p.b.reviews90d,
      totalReviews: p.b.totalReviews,
      dofollowReferringDomains: p.b.dofollowReferringDomains,
      pageCleanDofollowRefDomains: p.b.pageCleanDofollowRefDomains,
      rootCleanDofollowRefDomains: p.b.rootCleanDofollowRefDomains,
      combinedAuthorityScore: round1(p.b.combinedAuthorityScore * 100),
      authorityStrengthLabel: p.b.authorityStrengthLabel,
      authorityNote: p.b.authorityNote,
      usedSameTargetForPageAndRoot: p.b.usedSameTargetForPageAndRoot,
      hasDedicatedLocalPage: p.b.hasDedicatedLocalPage,
      localPageTier: localPageTier(p.b),
      gmbPrimaryCategory: p.b.gmbPrimaryCategory,
      franchise: p.b.franchise,
    })),
    mainReasons: buildReasons(bucketScores, top3),
    weakestSignalsInTop3: buildWeaknesses(top3),
    opportunityNotes: buildOpportunities(bucketScores, cityLabel || "local"),
  };
}
