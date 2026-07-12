/** DataForSEO domain rank is 0–1000; normalize to 0–100 power score. */
export function rankToPower(rank: number | null | undefined): number | null {
  if (rank == null || rank <= 0) return null;
  return Math.min(100, Math.round(rank / 10));
}

export type TopicalFit = "topical" | "random" | "unknown";

const GENERIC_ANCHORS =
  /^(click here|here|website|visit|read more|link|url|learn more|this site|homepage|home|more info|view site)$/i;

const TOPICAL_SOURCE_TYPES = new Set([
  "Citation / Directory",
  "Local website",
  "Industry website",
  "Supplier / manufacturer",
  "Sponsorship / community",
  "News / PR",
]);

function industryTokens(category: string | null | undefined, keyword: string | null | undefined): string[] {
  const raw = `${category ?? ""} ${keyword ?? ""}`.toLowerCase();
  const words = raw.split(/[\s,/|-]+/).filter((w) => w.length > 3);
  const extras = ["junk", "removal", "haul", "hauling", "debris", "cleanout", "dumpster", "trash", "rubbish"];
  return [...new Set([...words, ...extras])];
}

export function assessTopicalFit(params: {
  anchor?: string | null;
  title?: string | null;
  domain?: string | null;
  sourceType?: string | null;
  category?: string | null;
  keyword?: string | null;
  city?: string | null;
}): TopicalFit {
  const haystack = [params.anchor, params.title, params.domain, params.sourceType]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  if (!haystack.trim()) return "unknown";

  const tokens = industryTokens(params.category, params.keyword);
  if (tokens.some((t) => haystack.includes(t))) return "topical";

  const city = params.city?.toLowerCase().replace(/[^a-z]/g, "");
  if (city && city.length > 3 && haystack.includes(city)) return "topical";

  if (params.sourceType && TOPICAL_SOURCE_TYPES.has(params.sourceType)) return "topical";

  const anchor = params.anchor?.trim();
  if (anchor && GENERIC_ANCHORS.test(anchor)) return "random";
  if (params.sourceType === "Unknown" && !tokens.some((t) => haystack.includes(t))) return "random";

  if (anchor && anchor.length > 3 && !GENERIC_ANCHORS.test(anchor)) {
    const anchorLower = anchor.toLowerCase();
    if (tokens.some((t) => anchorLower.includes(t))) return "topical";
  }

  return "unknown";
}

export function linkPassesPower(dofollow: boolean | null | undefined): "passes" | "nofollow" | "unknown" {
  if (dofollow === true) return "passes";
  if (dofollow === false) return "nofollow";
  return "unknown";
}
