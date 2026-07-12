const STOP_WORDS = new Set([
  "a",
  "an",
  "the",
  "and",
  "or",
  "in",
  "near",
  "for",
  "of",
  "service",
  "services",
  "company",
  "llc",
  "inc",
]);

function normalizeCategory(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(text: string): string[] {
  return normalizeCategory(text)
    .split(" ")
    .filter((t) => t.length > 2 && !STOP_WORDS.has(t));
}

function tokenOverlap(a: string, b: string): number {
  const ta = new Set(tokens(a));
  const tb = new Set(tokens(b));
  let overlap = 0;
  for (const t of ta) {
    if (tb.has(t)) overlap++;
  }
  return overlap;
}

/** True when competitor category aligns with target category or search keyword. */
export function categoryMatchesScan(
  competitorCategory: string | undefined | null,
  params: {
    targetCategory?: string | null;
    keyword?: string | null;
  }
): boolean {
  if (!competitorCategory?.trim()) return false;

  const comp = normalizeCategory(competitorCategory);
  const target = params.targetCategory ? normalizeCategory(params.targetCategory) : "";

  if (target) {
    if (comp === target) return true;
    if (comp.includes(target) || target.includes(comp)) return true;
    if (tokenOverlap(comp, target) >= 1) return true;
  }

  const keyword = params.keyword?.trim();
  if (keyword) {
    const kwTokens = tokens(keyword);
    if (kwTokens.length === 0) return false;
    const compTokens = new Set(tokens(comp));
    const hits = kwTokens.filter((t) => compTokens.has(t)).length;
    if (hits >= 1) return true;
    const kwNorm = normalizeCategory(keyword);
    if (comp.includes(kwNorm) || kwNorm.includes(comp)) return true;
  }

  return false;
}

const EXCLUDED_INTENT_CATEGORIES = [
  "moving",
  "mover",
  "movers",
  "relocation",
  "storage",
  "courier",
  "real estate",
  "apartment",
];

function serviceTokensFromKeyword(keyword: string, locationTokens: string[]): string[] {
  const loc = new Set(locationTokens.map((t) => normalizeCategory(t)).filter(Boolean));
  return tokens(keyword).filter((t) => !loc.has(t));
}

/**
 * Map-pack competitor must match search intent — category OR business name aligns with
 * the keyword service terms (e.g. "junk" + "removal"), not just "top 3 anywhere on grid".
 */
export function competitorMatchesSearchIntent(
  name: string | undefined | null,
  category: string | undefined | null,
  params: {
    targetCategory?: string | null;
    keyword?: string | null;
    locationTokens?: string[];
  }
): boolean {
  const compCat = normalizeCategory(category ?? "");
  for (const bad of EXCLUDED_INTENT_CATEGORIES) {
    if (compCat.includes(bad)) return false;
  }

  const nameNorm = normalizeCategory(name ?? "");
  for (const bad of EXCLUDED_INTENT_CATEGORIES) {
    if (nameNorm.includes(bad)) return false;
  }

  if (categoryMatchesScan(category, params)) return true;

  const keyword = params.keyword?.trim();
  if (!keyword || !name?.trim()) return false;

  const serviceTokens = serviceTokensFromKeyword(keyword, params.locationTokens ?? []);
  if (serviceTokens.length === 0) return false;

  const nameTokenSet = new Set(tokens(name));
  const hits = serviceTokens.filter((t) => nameTokenSet.has(t) || nameNorm.includes(t)).length;
  if (hits >= 2) return true;
  if (hits >= 1 && serviceTokens.length === 1) return true;

  const phrase = serviceTokens.join(" ");
  return phrase.length > 4 && nameNorm.includes(phrase);
}

export const TOP_PACK_RANK = 3;

export function isTopPackRank(rank: number | undefined | null): rank is number {
  return rank != null && rank >= 1 && rank <= TOP_PACK_RANK;
}
