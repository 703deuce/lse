import * as cheerio from "cheerio";
import { scrapeWebsite } from "@/lib/providers/scrapingdog";
import { safeFetchWebsite, safeReadText } from "@/lib/validation/ssrf";

export type FetchedOpportunityPage = {
  url: string;
  fetchStatus: "ok" | "failed" | "too_thin";
  title: string | null;
  headings: string[];
  bodyText: string;
  wordCount: number;
  actionLinks: Array<{ label: string; href: string }>;
  contactHints: string[];
  organizationName: string | null;
};

const MIN_WORDS = 80;
const MAX_BODY_CHARS = 6000;

function stripAndCollapse(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function extractActionLinks($: cheerio.CheerioAPI, baseUrl: string): Array<{ label: string; href: string }> {
  const links: Array<{ label: string; href: string }> = [];
  const patterns =
    /sponsor|member|join|apply|donat|contact|vendor|directory|register|sign\s*up|become|partner|membership/i;

  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    const label = $(el).text().trim();
    if (!href || !label) return;
    if (!patterns.test(`${label} ${href}`)) return;
    try {
      const u = new URL(href, baseUrl);
      links.push({ label: label.slice(0, 80), href: u.toString() });
    } catch {
      /* skip invalid href */
    }
  });

  return links.slice(0, 15);
}

function extractContactHints($: cheerio.CheerioAPI, text: string): string[] {
  const hints: string[] = [];
  $('a[href^="tel:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) hints.push(href);
  });
  $('a[href^="mailto:"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) hints.push(href);
  });
  const phone = text.match(/(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/);
  if (phone) hints.push(phone[0]);
  return [...new Set(hints)].slice(0, 5);
}

function emptyPage(url: string, fetchStatus: "failed" | "too_thin"): FetchedOpportunityPage {
  return {
    url,
    fetchStatus,
    title: null,
    headings: [],
    bodyText: "",
    wordCount: 0,
    actionLinks: [],
    contactHints: [],
    organizationName: null,
  };
}

export async function fetchOpportunityPage(
  url: string,
  organizationId?: string
): Promise<FetchedOpportunityPage> {
  let html = "";
  try {
    const res = await safeFetchWebsite(url, 15000);
    html = await safeReadText(res);
  } catch {
    try {
      html = await scrapeWebsite({ url, organizationId });
    } catch {
      return emptyPage(url, "failed");
    }
  }

  if (!html || html.length < 200) {
    return emptyPage(url, "failed");
  }

  const $ = cheerio.load(html);
  $("script, style, noscript").remove();

  const title = $("title").text().trim() || null;
  const headings = [
    ...$("h1")
      .map((_, el) => $(el).text().trim())
      .get(),
    ...$("h2")
      .map((_, el) => $(el).text().trim())
      .get(),
  ]
    .filter(Boolean)
    .slice(0, 12);

  const bodyText = stripAndCollapse($("body").text()).slice(0, MAX_BODY_CHARS);
  const wordCount = bodyText.split(/\s+/).filter(Boolean).length;

  if (wordCount < MIN_WORDS) {
    return {
      ...emptyPage(url, "too_thin"),
      title,
      headings,
      bodyText,
      wordCount,
      organizationName: headings[0] ?? title,
    };
  }

  return {
    url,
    fetchStatus: "ok",
    title,
    headings,
    bodyText,
    wordCount,
    actionLinks: extractActionLinks($, url),
    contactHints: extractContactHints($, bodyText),
    organizationName: headings[0] ?? title,
  };
}
