import { dataForSeoOrganicSearch } from "@/lib/providers/dataforseo/organic";
import { scrapingDogGoogleSearch } from "@/lib/providers/scrapingdog/google-search";

export type SearchHit = {
  title: string;
  url: string;
  description?: string;
  domain: string;
};

function domainFromUrl(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

export async function searchCitations(params: {
  query: string;
  organizationId?: string;
}): Promise<{ hits: SearchHit[]; provider: string; warning?: string }> {
  try {
    const items = await dataForSeoOrganicSearch({
      keyword: params.query,
      organizationId: params.organizationId,
      depth: 10,
    });
    return {
      provider: "primary",
      hits: items.map((i) => ({
        title: i.title ?? "",
        url: i.url ?? "",
        description: i.description,
        domain: domainFromUrl(i.url ?? ""),
      })),
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    try {
      const items = await scrapingDogGoogleSearch({
        query: params.query,
        organizationId: params.organizationId,
      });
      return {
        provider: "fallback",
        warning: `Primary search unavailable: ${msg}`,
        hits: items.map((i) => ({
          title: i.title ?? "",
          url: i.url ?? "",
          description: i.description,
          domain: domainFromUrl(i.url ?? ""),
        })),
      };
    } catch (fallbackErr) {
      const fb = fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr);
      return { provider: "none", warning: `${msg}; fallback: ${fb}`, hits: [] };
    }
  }
}

export function buildDiscoveryQueries(business: {
  name: string;
  phone?: string | null;
  address?: string | null;
  website?: string | null;
  city?: string | null;
}): string[] {
  const name = business.name.trim();
  const city = business.city?.trim();
  const queries = [
    `"${name}" "${business.phone ?? ""}"`.trim(),
    `"${name}" "${business.address ?? ""}"`.trim(),
    business.website ? `"${name}" "${domainOnly(business.website)}"` : "",
    city && business.phone ? `"${business.phone}" "${city}"` : "",
  ].filter((q) => q.length > 8);

  return [...new Set(queries)];
}

export function buildSiteQueries(businessName: string, domains: string[]): string[] {
  return domains.map((d) => `"${businessName.trim()}" site:${d}`);
}

function domainOnly(url: string): string {
  try {
    return new URL(url.startsWith("http") ? url : `https://${url}`).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

export function matchHitToSource(hit: SearchHit, sourceDomain: string): boolean {
  const d = hit.domain.toLowerCase();
  const s = sourceDomain.toLowerCase();
  return d === s || d.endsWith(`.${s}`) || s.endsWith(`.${d}`);
}
