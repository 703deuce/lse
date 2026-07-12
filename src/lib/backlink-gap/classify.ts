export const SOURCE_TYPES = [
  "Citation / Directory",
  "Local website",
  "Industry website",
  "Supplier / manufacturer",
  "Sponsorship / community",
  "Guest article",
  "News / PR",
  "Blog mention",
  "Social/profile",
  "Unknown",
  "Spam / Ignore",
] as const;

export type SourceType = (typeof SOURCE_TYPES)[number];

const DIRECTORY_DOMAINS = [
  "yelp.com",
  "bbb.org",
  "facebook.com",
  "linkedin.com",
  "yellowpages.com",
  "angi.com",
  "homeadvisor.com",
  "thumbtack.com",
  "mapquest.com",
  "foursquare.com",
  "manta.com",
  "chamberofcommerce.com",
  "superpages.com",
  "citysearch.com",
  "hotfrog.com",
  "brownbook.net",
  "cylex.us",
  "showmelocal.com",
  "merchantcircle.com",
];

const SOCIAL_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
  "youtube.com",
  "tiktok.com",
  "pinterest.com",
  "nextdoor.com",
];

const NEWS_PATTERNS = [/news/i, /herald/i, /tribune/i, /gazette/i, /journal/i, /times/i, /post\.com/i, /patch\.com/i];
const LOCAL_PATTERNS = [/chamber/i, /local/i, /cityof/i, /\.gov$/i, /community/i, /rotary/i, /kiwanis/i];
const INDUSTRY_PATTERNS = [/association/i, /institute/i, /contractor/i, /trade/i, /hvac/i, /plumb/i, /roof/i];
const SUPPLIER_PATTERNS = [/supply/i, /supplier/i, /manufacturer/i, /wholesale/i, /distributor/i];
const SPONSOR_PATTERNS = [/sponsor/i, /foundation/i, /charity/i, /nonprofit/i, /org$/i];

export function classifySourceType(
  domain: string,
  signals?: {
    platformTypes?: Record<string, number>;
    isSpam?: boolean;
  }
): SourceType {
  if (signals?.isSpam) return "Spam / Ignore";

  const d = domain.toLowerCase();

  if (DIRECTORY_DOMAINS.some((x) => d === x || d.endsWith(`.${x}`))) {
    return "Citation / Directory";
  }
  if (SOCIAL_DOMAINS.some((x) => d === x || d.endsWith(`.${x}`))) {
    return "Social/profile";
  }
  if (NEWS_PATTERNS.some((p) => p.test(d))) return "News / PR";
  if (LOCAL_PATTERNS.some((p) => p.test(d))) return "Local website";
  if (INDUSTRY_PATTERNS.some((p) => p.test(d))) return "Industry website";
  if (SUPPLIER_PATTERNS.some((p) => p.test(d))) return "Supplier / manufacturer";
  if (SPONSOR_PATTERNS.some((p) => p.test(d))) return "Sponsorship / community";

  const platforms = signals?.platformTypes ?? {};
  if ((platforms.news ?? 0) > 0) return "News / PR";
  if ((platforms.blogs ?? 0) > 0) return "Blog mention";
  if ((platforms.organization ?? 0) > 0) return "Local website";

  return "Unknown";
}
