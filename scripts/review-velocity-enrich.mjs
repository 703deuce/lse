/**
 * Enrich review-velocity-report.json with three more comparison dimensions:
 *
 *   1. GMB profile   — ScrapingDog place_details: categories, service options,
 *                      attributes/extensions, description, hours, etc.
 *   2. On-page SEO   — homepage title / H1s / meta description + whether the
 *                      keyword ("junk removal") and city appear on the page.
 *   3. Authority     — DataForSEO REFERRING DOMAINS (dofollow only), top 100
 *                      by rank (strongest first). Replaces the per-backlink metric.
 *
 * Usage (PowerShell):
 *   node scripts/review-velocity-enrich.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REPORT_PATH = resolve(ROOT, process.env.REPORT_PATH ?? "scripts/review-velocity-report.json");
const REF_DOMAIN_LIMIT = 100;
const SEARCH_ZOOM = 12;

// ---------------------------------------------------------------------------
// env
// ---------------------------------------------------------------------------
function loadEnvFile(filename) {
  try {
    const text = readFileSync(resolve(ROOT, filename), "utf8");
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }
      if (!process.env[key]) process.env[key] = value;
    }
  } catch {
    /* optional */
  }
}

loadEnvFile(".env.local");
loadEnvFile(".env");

const SD_KEY = process.env.SCRAPINGDOG_API_KEY ?? process.env.SCRAPING_DOG_API_KEY;
const DFS_USER = process.env.DATAFORSEO_USERNAME;
const DFS_PASS = process.env.DATAFORSEO_PASSWORD;
if (!SD_KEY) {
  console.error("Missing SCRAPINGDOG_API_KEY");
  process.exit(1);
}
if (!DFS_USER || !DFS_PASS) {
  console.error("Missing DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const norm = (s) => (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");

function domainFromUrl(url) {
  if (!url?.trim()) return null;
  try {
    const host = new URL(url.startsWith("http") ? url : `https://${url}`).hostname;
    return host.replace(/^www\./i, "").toLowerCase();
  } catch {
    return null;
  }
}
function normalizeDomain(input) {
  if (!input?.trim()) return null;
  const t = input.trim().toLowerCase();
  if (t.includes("/") || t.startsWith("http")) return domainFromUrl(t);
  return t.replace(/^www\./, "").split("/")[0] || null;
}

// ---------------------------------------------------------------------------
// ScrapingDog
// ---------------------------------------------------------------------------
async function sdGet(path, params) {
  const url = new URL(`https://api.scrapingdog.com/${path}`);
  url.searchParams.set("api_key", SD_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 400) };
  }
  return { ok: res.ok, status: res.status, body };
}

async function mapsSearch(query, searchPoint) {
  const params = { query };
  if (searchPoint) params.ll = `@${searchPoint.lat},${searchPoint.lng},${SEARCH_ZOOM}z`;
  const res = await sdGet("google_maps", params);
  if (!res.ok) return [];
  return Array.isArray(res.body) ? res.body : res.body?.search_results ?? [];
}

function matchMapsResult(mapsResults, biz) {
  const nameKey = norm(biz.name);
  return (
    mapsResults.find((r) => norm(r.title) === nameKey) ??
    mapsResults.find((r) => {
      const t = norm(r.title);
      return t && (t.startsWith(nameKey.slice(0, 14)) || nameKey.startsWith(t.slice(0, 14)));
    }) ??
    null
  );
}

function firstArray(...vals) {
  for (const v of vals) if (Array.isArray(v) && v.length) return v;
  return [];
}

/** Curate GMB profile fields from ScrapingDog place_details. */
function extractGmbProfile(details, mapsHit) {
  const pr = details?.place_results ?? details ?? {};
  const categories = firstArray(pr.types, pr.categories, pr.category ? [pr.category] : []);
  const serviceOptions =
    pr.service_options ??
    pr.serviceOptions ??
    pr.service_options_list ??
    (Array.isArray(pr.extensions) ? undefined : undefined);
  const attributes = firstArray(pr.extensions, pr.attributes, pr.about);

  return {
    primaryCategory: pr.type ?? mapsHit?.type ?? categories[0] ?? null,
    categories: categories.slice(0, 15),
    categoryCount: categories.length,
    description: pr.description ?? pr.editorial_summary ?? null,
    serviceOptions: serviceOptions ?? null,
    attributes: attributes.slice(0, 40),
    hasHours: Boolean(pr.hours ?? pr.working_hours ?? pr.open_state ?? pr.open_hours),
    priceRange: pr.price ?? pr.price_range ?? null,
    yearsInBusiness: pr.years_in_business ?? null,
    thumbnail: Boolean(pr.thumbnail ?? pr.photo ?? pr.images),
    phone: pr.phone ?? mapsHit?.phone ?? null,
    website: pr.website ?? mapsHit?.website ?? null,
    address: pr.address ?? mapsHit?.address ?? null,
    plusCode: pr.plus_code ?? null,
    rawKeys: Object.keys(pr).slice(0, 40),
  };
}

// ---------------------------------------------------------------------------
// On-page SEO (homepage fetch + regex extraction)
// ---------------------------------------------------------------------------
function stripTags(html) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function extractTag(html, tag) {
  const out = [];
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, "gi");
  let m;
  while ((m = re.exec(html)) && out.length < 10) {
    const t = stripTags(m[1]);
    if (t) out.push(t);
  }
  return out;
}

function extractMeta(html, name) {
  const patterns = [
    new RegExp(`<meta[^>]*name=["']${name}["'][^>]*content=["']([^"']*)["']`, "i"),
    new RegExp(`<meta[^>]*content=["']([^"']*)["'][^>]*name=["']${name}["']`, "i"),
  ];
  for (const re of patterns) {
    const m = html.match(re);
    if (m) return stripTags(m[1]);
  }
  return null;
}

async function fetchHtml(website) {
  // 1) direct fetch with browser UA
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const res = await fetch(website, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36",
        Accept: "text/html",
      },
      signal: controller.signal,
      redirect: "follow",
    });
    clearTimeout(timer);
    if (res.ok) {
      const html = await res.text();
      if (html && html.length > 500) return { html, source: "direct" };
    }
  } catch {
    /* fall through */
  }
  // 2) ScrapingDog scrape fallback
  try {
    const res = await sdGet("scrape", { url: website, dynamic: "false" });
    if (res.ok) {
      const html = typeof res.body === "string" ? res.body : res.body?.html ?? res.body?.raw ?? "";
      if (html && html.length > 500) return { html, source: "scrapingdog" };
    }
  } catch {
    /* ignore */
  }
  return { html: null, source: "failed" };
}

function analyzeOnPage(html, cityToken, kwTokens) {
  if (!html) return { ok: false };
  const title = extractTag(html, "title")[0] ?? null;
  const h1 = extractTag(html, "h1");
  const h2 = extractTag(html, "h2");
  const metaDesc = extractMeta(html, "description");
  const bodyText = stripTags(html).toLowerCase().slice(0, 20000);

  const titleL = (title ?? "").toLowerCase();
  const h1L = h1.join(" ").toLowerCase();
  const hasCity = (s) => (cityToken ? s.includes(cityToken) : false);
  const hasKw = (s) => kwTokens.every((t) => s.includes(t)); // all kw tokens present

  return {
    ok: true,
    title,
    titleLength: title?.length ?? 0,
    metaDescription: metaDesc,
    h1: h1.slice(0, 5),
    h1Count: h1.length,
    h2Count: h2.length,
    kwInTitle: hasKw(titleL),
    cityInTitle: hasCity(titleL),
    kwInH1: hasKw(h1L),
    cityInH1: hasCity(h1L),
    kwInBody: hasKw(bodyText),
    cityInBody: hasCity(bodyText),
    cityMentionsBody: cityToken ? (bodyText.match(new RegExp(cityToken, "g")) ?? []).length : 0,
  };
}

// ---------------------------------------------------------------------------
// DataForSEO — dofollow referring domains
// ---------------------------------------------------------------------------
async function dfsPost(endpoint, body, timeoutMs = 120_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
      method: "POST",
      headers: {
        Authorization: "Basic " + Buffer.from(`${DFS_USER}:${DFS_PASS}`).toString("base64"),
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await res.json();
    if (!res.ok) throw new Error(`DFS HTTP ${res.status}`);
    const task = data.tasks?.[0];
    if (task?.status_code && task.status_code >= 40000) {
      throw new Error(task.status_message ?? `DFS task error ${task.status_code}`);
    }
    return data;
  } finally {
    clearTimeout(timer);
  }
}

/** Top N dofollow referring domains, strongest (rank) first. */
async function fetchDofollowReferringDomains(domain) {
  const data = await dfsPost("backlinks/referring_domains/live", [
    {
      target: domain,
      limit: REF_DOMAIN_LIMIT,
      order_by: ["rank,desc"],
      backlinks_status_type: "live",
      backlinks_filters: ["dofollow", "=", true],
      exclude_internal_backlinks: true,
      rank_scale: "one_thousand",
    },
  ]);

  const result = data.tasks?.[0]?.result?.[0];
  const rawItems = result?.items ?? [];
  const items = rawItems.map((item) => ({
    domain: item.domain ?? null,
    rank: typeof item.rank === "number" ? item.rank : null,
    backlinks: typeof item.backlinks === "number" ? item.backlinks : 0,
    dofollowBacklinks:
      typeof item.referring_links_types?.anchor === "number"
        ? undefined
        : typeof item.backlinks === "number"
          ? item.backlinks
          : 0,
    firstSeen: item.first_seen ? String(item.first_seen).slice(0, 10) : null,
    lostDate: item.lost_date ? String(item.lost_date).slice(0, 10) : null,
    spamScore: typeof item.backlinks_spam_score === "number" ? item.backlinks_spam_score : null,
  }));
  items.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

  const ranks = items.map((i) => i.rank).filter((r) => r != null);
  const top10 = ranks.slice(0, 10);
  return {
    totalDofollowReferringDomains: result?.total_count ?? items.length,
    fetched: items.length,
    top100ReferringDomains: items.slice(0, REF_DOMAIN_LIMIT),
    summary: {
      strongestDomainRank: ranks[0] ?? null,
      avgTop10DomainRank: top10.length
        ? Math.round((top10.reduce((a, b) => a + b, 0) / top10.length) * 10) / 10
        : null,
      cleanDomains: items.filter((i) => (i.spamScore ?? 0) <= 10).length,
    },
  };
}

function orderBy(businesses, valueOf, dir = "desc") {
  const order = new Map();
  const sorted = [...businesses].sort((a, b) => {
    const av = valueOf(a) ?? -Infinity;
    const bv = valueOf(b) ?? -Infinity;
    return dir === "desc" ? bv - av : av - bv;
  });
  sorted.forEach((b, i) => order.set(b, i + 1));
  return order;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
function cityTokenFromLabel(label) {
  return norm(label.split(",")[0]);
}
function kwTokensFromQuery(query) {
  // "junk removal woodbridge va" → core service tokens
  return ["junk", "removal"];
}

async function main() {
  const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));

  for (const city of report.report) {
    console.log("\n" + "=".repeat(84));
    console.log(city.label);
    console.log("=".repeat(84));

    const cityToken = cityTokenFromLabel(city.label);
    const kwTokens = kwTokensFromQuery(city.query);
    const mapsResults = await mapsSearch(city.query, city.searchPoint);
    await sleep(500);

    for (const biz of city.businesses) {
      console.log(`\n  #${biz.rank} ${biz.name}`);
      const hit = matchMapsResult(mapsResults, biz);
      const placeId = hit?.place_id ?? null;
      biz.placeId = placeId;
      const website = biz.website ?? hit?.website ?? null;
      const domain = biz.domain ?? normalizeDomain(website);

      // 1) GMB profile
      if (biz.gmb && !biz.gmb.error) {
        console.log(`     GMB: cached (${biz.gmb.primaryCategory ?? "?"})`);
      } else if (placeId) {
        try {
          const details = await sdGet("google_maps/places", { place_id: placeId });
          biz.gmb = extractGmbProfile(details.ok ? details.body : {}, hit);
          console.log(
            `     GMB: ${biz.gmb.primaryCategory ?? "?"} | ${biz.gmb.categoryCount} categories | ` +
              `${biz.gmb.attributes.length} attributes | hours:${biz.gmb.hasHours}`
          );
        } catch (e) {
          biz.gmb = { error: String(e?.message ?? e) };
          console.log(`     GMB failed: ${biz.gmb.error}`);
        }
        await sleep(500);
      } else {
        biz.gmb = { error: "No place_id matched" };
        console.log("     GMB: no place_id matched");
      }

      // 2) On-page SEO
      if (biz.onPage && biz.onPage.ok) {
        console.log(`     OnPage: cached ("${(biz.onPage.title ?? "").slice(0, 45)}")`);
      } else if (website) {
        const { html, source } = await fetchHtml(website);
        biz.onPage = { ...analyzeOnPage(html, cityToken, kwTokens), fetchSource: source, website };
        if (biz.onPage.ok) {
          console.log(
            `     OnPage[${source}]: title "${(biz.onPage.title ?? "").slice(0, 55)}" | ` +
              `kw+city in title:${biz.onPage.kwInTitle && biz.onPage.cityInTitle} | ` +
              `h1s:${biz.onPage.h1Count} | city body mentions:${biz.onPage.cityMentionsBody}`
          );
        } else {
          console.log(`     OnPage: fetch failed (${source})`);
        }
        await sleep(400);
      } else {
        biz.onPage = { ok: false, error: "No website" };
      }

      // 3) Authority — dofollow referring domains
      if (biz.refDomainsAuthority && !biz.refDomainsAuthority.error) {
        console.log(
          `     RefDomains: cached (${biz.refDomainsAuthority.totalDofollowReferringDomains} total)`
        );
      } else if (domain) {
        try {
          const auth = await fetchDofollowReferringDomains(domain);
          biz.refDomainsAuthority = auth;
          console.log(
            `     RefDomains(dofollow): ${auth.totalDofollowReferringDomains} total | ` +
              `strongest rank ${auth.summary.strongestDomainRank ?? "?"} | ` +
              `clean ${auth.summary.cleanDomains}/${auth.fetched}`
          );
        } catch (e) {
          biz.refDomainsAuthority = { error: String(e?.message ?? e) };
          console.log(`     RefDomains failed: ${biz.refDomainsAuthority.error}`);
        }
        await sleep(1000);
      } else {
        biz.refDomainsAuthority = { error: "No domain" };
      }
    }

    // within-pack authority order by dofollow referring domains (rank, then count)
    const authOrd = orderBy(
      city.businesses,
      (b) => {
        const s = b.refDomainsAuthority?.summary?.strongestDomainRank;
        const c = b.refDomainsAuthority?.totalDofollowReferringDomains ?? 0;
        return s != null ? s * 100000 + c : c;
      },
      "desc"
    );
    for (const b of city.businesses) b.refDomainAuthorityOrder = authOrd.get(b) ?? null;
  }

  report.enrichedAt = new Date().toISOString();
  report.enrichMethod =
    "GMB via ScrapingDog place_details; on-page via homepage fetch (regex title/h1/meta); " +
    "authority via DataForSEO backlinks/referring_domains/live dofollow=true, order_by rank desc, top 100";

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nUpdated → ${REPORT_PATH}`);

  // ---- summary ----
  console.log("\n" + "#".repeat(84));
  console.log("COMBINED SUMMARY");
  console.log("#".repeat(84));
  for (const city of report.report) {
    console.log(`\n${city.label}`);
    for (const b of city.businesses) {
      const a = b.refDomainsAuthority?.summary;
      const op = b.onPage ?? {};
      console.log(
        `  #${b.rank} ${(b.name ?? "").slice(0, 26).padEnd(26)} | ` +
          `dist ${String(b.distanceMi ?? "?").padStart(5)}mi | 90d ${String(b.reviews90d).padStart(3)} | ` +
          `refDoms ${String(b.refDomainsAuthority?.totalDofollowReferringDomains ?? "?").padStart(4)} ` +
          `(auth#${b.refDomainAuthorityOrder ?? "?"}) | ` +
          `cats ${String(b.gmb?.categoryCount ?? "?").padStart(2)} | ` +
          `kw+city title:${op.kwInTitle && op.cityInTitle ? "Y" : "n"} h1:${op.kwInH1 && op.cityInH1 ? "Y" : "n"}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
