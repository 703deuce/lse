import { safeFetchWebsite } from "@/lib/validation/ssrf";
import type { ParsedPage } from "@/lib/audit/types";

function stripTags(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractAll(html: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "gi");
  const out: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const text = stripTags(m[1]).trim();
    if (text) out.push(text);
  }
  return out;
}

function extractMeta(html: string, name: string): string | null {
  const re = new RegExp(
    `<meta[^>]+(?:name|property)=["']${name}["'][^>]+content=["']([^"']+)["']`,
    "i"
  );
  const m = html.match(re);
  return m?.[1]?.trim() ?? null;
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const re = /href=["']([^"']+)["']/gi;
  let m: RegExpExecArray | null;
  const base = new URL(baseUrl);
  while ((m = re.exec(html))) {
    try {
      const u = new URL(m[1], baseUrl);
      if (u.hostname === base.hostname) links.push(u.pathname);
    } catch {
      /* skip */
    }
  }
  return [...new Set(links)].slice(0, 100);
}

const HOUR_PATTERNS = [
  /\b\d{1,2}\s?(?:am|pm)\s?[-–to]+\s?\d{1,2}\s?(?:am|pm)\b/gi,
  /\b(?:mon|tue|wed|thu|fri|sat|sun)[a-z]*\b/gi,
  /\bopen 24 hours\b/gi,
];

export async function fetchAndParsePage(url: string): Promise<ParsedPage> {
  const res = await safeFetchWebsite(url, 15000);
  const html = await res.text();
  const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i);
  const bodyText = stripTags(html);
  const telLinks = /href=["']tel:([^"']+)["']/gi.test(html);

  const hoursMentions: string[] = [];
  for (const pat of HOUR_PATTERNS) {
    const found = bodyText.match(pat);
    if (found) hoursMentions.push(...found.slice(0, 3));
  }

  return {
    url,
    title: titleMatch?.[1]?.trim() ?? null,
    metaDescription: extractMeta(html, "description"),
    h1: extractAll(html, "h1"),
    h2: extractAll(html, "h2"),
    h3: extractAll(html, "h3"),
    bodyText,
    wordCount: bodyText.split(/\s+/).filter(Boolean).length,
    hasClickToCall: telLinks,
    internalLinks: extractLinks(html, url),
    hoursMentions: [...new Set(hoursMentions)],
    neighborhoodMentions: [],
  };
}

export async function crawlSitePages(baseUrl: string, maxPages = 12): Promise<ParsedPage[]> {
  const homepage = await fetchAndParsePage(baseUrl);
  const pages: ParsedPage[] = [homepage];
  const candidates = homepage.internalLinks
    .filter((p) => /service|location|area|about|junk|removal|appliance|neighborhood|city|county/i.test(p))
    .slice(0, maxPages - 1);

  for (const path of candidates) {
    try {
      const full = new URL(path, baseUrl).toString();
      pages.push(await fetchAndParsePage(full));
    } catch {
      /* skip unreachable pages */
    }
  }
  return pages;
}

export function pageMatchesService(page: ParsedPage, service: string): boolean {
  const s = service.toLowerCase();
  const hay = [page.title, page.metaDescription, ...page.h1, ...page.h2, page.url].join(" ").toLowerCase();
  return hay.includes(s);
}

export function suggestPageTitle(service: string, city?: string | null, state?: string | null): string {
  const loc = [city, state].filter(Boolean).join(", ");
  return loc ? `${service} in ${loc}` : `${service} Services`;
}
