/**
 * Page + root domain authority for Maps Keyword Difficulty.
 * Root and local page carry equal weight (50/50) so franchise root domains help
 * without over-crediting zero-link location pages.
 */

export const AUTHORITY_ROOT_WEIGHT = 0.5;
export const AUTHORITY_PAGE_WEIGHT = 0.5;

export interface RefDomainsAuthorityData {
  totalDofollowReferringDomains: number;
  fetched: number;
  summary: {
    strongestDomainRank: number | null;
    avgTop10DomainRank?: number | null;
    cleanDomains: number;
  };
  error?: string;
}

export interface CompetitorAuthority {
  pageTargetUrl: string | null;
  rootDomain: string | null;
  pageRefDomains: number;
  pageDofollowRefDomains: number;
  pageCleanDofollowRefDomains: number;
  pageAuthorityScore: number;
  rootRefDomains: number;
  rootDofollowRefDomains: number;
  rootCleanDofollowRefDomains: number;
  rootAuthorityScore: number;
  combinedAuthorityScore: number;
  authoritySourceType: "page_and_root" | "root_only";
  usedSameTargetForPageAndRoot: boolean;
  pageStrongestReferringDomainRank: number | null;
  rootStrongestReferringDomainRank: number | null;
  error?: string;
}

export function isHomepageAuthorityTarget(url: string): boolean {
  try {
    const p = new URL(url.startsWith("http") ? url : `https://${url}`).pathname.replace(/\/+$/, "");
    return p === "" || p === "/" || /^\/(home|index(\.html?)?)$/i.test(p);
  } catch {
    return true;
  }
}

/** True when page and root should share one backlink lookup (homepage / root URL). */
export function isSameAuthorityTarget(pageTargetUrl: string, rootDomain: string): boolean {
  if (isHomepageAuthorityTarget(pageTargetUrl)) return true;
  try {
    const u = new URL(pageTargetUrl.startsWith("http") ? pageTargetUrl : `https://${pageTargetUrl}`);
    const host = u.hostname.replace(/^www\./i, "").toLowerCase();
    const root = rootDomain.replace(/^www\./i, "").toLowerCase();
    if (host !== root) return false;
    const path = u.pathname.replace(/\/+$/, "") || "/";
    return path === "/";
  } catch {
    return true;
  }
}

export function resolvePageTargetUrl(
  landingUrl: string | null | undefined,
  website: string | null | undefined,
  domain: string | null | undefined
): string | null {
  if (landingUrl?.trim()) return landingUrl.trim();
  if (website?.trim()) return website.trim();
  if (domain?.trim()) return `https://${domain.replace(/^www\./i, "")}/`;
  return null;
}

export function estimateCleanRefDomains(ref: RefDomainsAuthorityData | null | undefined): number {
  if (!ref || ref.error) return 0;
  const total = ref.totalDofollowReferringDomains || 0;
  const fetched = ref.fetched || 0;
  const clean = ref.summary?.cleanDomains ?? 0;
  if (fetched <= 0) return 0;
  return Math.round((clean / fetched) * total);
}

export function combineAuthorityScores(
  pageScore: number,
  rootScore: number,
  usedSameTargetForPageAndRoot: boolean
): number {
  if (usedSameTargetForPageAndRoot) return rootScore;
  return AUTHORITY_ROOT_WEIGHT * rootScore + AUTHORITY_PAGE_WEIGHT * pageScore;
}

export function authorityStrengthLabel(score: number): string {
  if (score >= 0.65) return "Strong";
  if (score >= 0.35) return "Moderate";
  if (score >= 0.12) return "Low";
  return "Weak";
}

export function buildCompetitorAuthority(params: {
  pageTargetUrl: string;
  rootDomain: string;
  pageRef: RefDomainsAuthorityData | null;
  rootRef: RefDomainsAuthorityData;
  pageAuthorityScore: number;
  rootAuthorityScore: number;
  usedSameTargetForPageAndRoot: boolean;
}): CompetitorAuthority {
  const pageRef = params.pageRef;
  const rootRef = params.rootRef;
  const combinedAuthorityScore = combineAuthorityScores(
    params.pageAuthorityScore,
    params.rootAuthorityScore,
    params.usedSameTargetForPageAndRoot
  );

  return {
    pageTargetUrl: params.pageTargetUrl,
    rootDomain: params.rootDomain,
    pageRefDomains: pageRef?.totalDofollowReferringDomains ?? 0,
    pageDofollowRefDomains: pageRef?.totalDofollowReferringDomains ?? 0,
    pageCleanDofollowRefDomains: estimateCleanRefDomains(pageRef),
    pageAuthorityScore: params.pageAuthorityScore,
    rootRefDomains: rootRef.totalDofollowReferringDomains ?? 0,
    rootDofollowRefDomains: rootRef.totalDofollowReferringDomains ?? 0,
    rootCleanDofollowRefDomains: estimateCleanRefDomains(rootRef),
    rootAuthorityScore: params.rootAuthorityScore,
    combinedAuthorityScore,
    authoritySourceType: params.usedSameTargetForPageAndRoot ? "root_only" : "page_and_root",
    usedSameTargetForPageAndRoot: params.usedSameTargetForPageAndRoot,
    pageStrongestReferringDomainRank: pageRef?.summary?.strongestDomainRank ?? null,
    rootStrongestReferringDomainRank: rootRef.summary?.strongestDomainRank ?? null,
  };
}

/** Soft note when page links are weak but root domain is stronger. */
export function rootSupportedAuthorityNote(auth: CompetitorAuthority | null | undefined): string | null {
  if (!auth || auth.usedSameTargetForPageAndRoot) return null;
  const pageClean = auth.pageCleanDofollowRefDomains;
  const rootClean = auth.rootCleanDofollowRefDomains;
  if (pageClean < 15 && rootClean >= 50) {
    return "This competitor's local page has limited page-level links, but the root domain has stronger authority signals. Root-domain authority may be helping support this local page.";
  }
  if (pageClean < 10 && rootClean >= 25 && rootClean > pageClean * 3) {
    return "Visible authority signals are stronger at the root domain than the location page. This may contribute to their competitive strength.";
  }
  return null;
}
