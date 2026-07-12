import * as cheerio from "cheerio";
import { safeFetchWebsite } from "@/lib/validation/ssrf";
import { scrapeWebsite } from "@/lib/providers/scrapingdog";

const PHONE_RE = /(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g;
const ADDRESS_RE =
  /\d+\s+[\w\s]+(?:st|street|rd|road|ave|avenue|dr|drive|ct|court|ln|lane|blvd|way|suite|ste|#)[\w\s,]*\d{5}/gi;

export type ParsedCitationPage = {
  title: string | null;
  name: string | null;
  address: string | null;
  phone: string | null;
  website: string | null;
  schemaFound: boolean;
  excerpt: string;
};

function extractFromSchema(html: string): Partial<ParsedCitationPage> {
  const out: Partial<ParsedCitationPage> = { schemaFound: false };
  const ldMatches = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  if (!ldMatches) return out;

  for (const block of ldMatches) {
    const jsonText = block.replace(/<script[^>]*>|<\/script>/gi, "").trim();
    try {
      const data = JSON.parse(jsonText) as Record<string, unknown>;
      const items = Array.isArray(data) ? data : [data];
      for (const item of items) {
        const type = String(item["@type"] ?? "");
        if (!/localbusiness|organization|store/i.test(type)) continue;
        out.schemaFound = true;
        if (typeof item.name === "string") out.name = item.name;
        if (typeof item.telephone === "string") out.phone = item.telephone;
        if (typeof item.url === "string") out.website = item.url;
        const addr = item.address as Record<string, string> | undefined;
        if (addr) {
          const parts = [addr.streetAddress, addr.addressLocality, addr.addressRegion, addr.postalCode].filter(Boolean);
          if (parts.length) out.address = parts.join(", ");
        }
      }
    } catch {
      /* skip invalid json-ld */
    }
  }
  return out;
}

function extractVisibleNap($: cheerio.CheerioAPI, html: string): Partial<ParsedCitationPage> {
  const text = $("body").text().replace(/\s+/g, " ");
  const phones = text.match(PHONE_RE);
  const addresses = text.match(ADDRESS_RE);
  const telHref = $('a[href^="tel:"]').first().attr("href")?.replace(/^tel:/i, "") ?? null;
  const webHref =
    $('a[rel="nofollow"][href^="http"]').first().attr("href") ??
    $('meta[property="og:url"]').attr("content") ??
    null;

  return {
    phone: telHref ?? phones?.[0] ?? null,
    address: addresses?.[0] ?? null,
    website: webHref,
    name: $("h1").first().text().trim() || null,
    excerpt: text.slice(0, 500),
  };
}

export async function parseCitationPage(
  url: string,
  organizationId?: string
): Promise<ParsedCitationPage> {
  let html = "";
  try {
    const res = await safeFetchWebsite(url, 12000);
    html = await res.text();
  } catch {
    try {
      html = await scrapeWebsite({ url, organizationId });
    } catch {
      return {
        title: null,
        name: null,
        address: null,
        phone: null,
        website: null,
        schemaFound: false,
        excerpt: "",
      };
    }
  }

  const $ = cheerio.load(html);
  const schema = extractFromSchema(html);
  const visible = extractVisibleNap($, html);

  return {
    title: $("title").text().trim() || null,
    name: schema.name ?? visible.name ?? null,
    address: schema.address ?? visible.address ?? null,
    phone: schema.phone ?? visible.phone ?? null,
    website: schema.website ?? visible.website ?? null,
    schemaFound: schema.schemaFound ?? false,
    excerpt: visible.excerpt ?? "",
  };
}
