/**
 * Find each competitor's best LOCAL landing page, then run on-page there.
 *
 * Strategy (cheap): one Google SERP `site:{domain} {city}` query lets Google pick
 * the page it most associates with that city (by content, not slug). If that top
 * result is a dedicated page (not the homepage), we run DataForSEO OnPage Instant
 * Pages on it. If site: returns nothing or only the homepage, we fall back to the
 * homepage on-page data already in the report.
 *
 * Backlinks/referring domains are NOT touched here — those stay on the domain.
 *
 * Usage (PowerShell):
 *   node scripts/review-velocity-landing.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REPORT_PATH = resolve(ROOT, process.env.REPORT_PATH ?? "scripts/review-velocity-report.json");

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

const DFS_USER = process.env.DATAFORSEO_USERNAME;
const DFS_PASS = process.env.DATAFORSEO_PASSWORD;
if (!DFS_USER || !DFS_PASS) {
  console.error("Missing DATAFORSEO_USERNAME / DATAFORSEO_PASSWORD");
  process.exit(1);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// The service we are actually ranking for.
const KW_TOKENS = ["junk", "removal"];
const SERVICE_TOKENS = ["junk", "removal", "hauling", "haul"];

function normStr(s) {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}
function cityFromLabel(label) {
  return label.split(",")[0].replace(/\(.*\)/, "").trim();
}
function isHomepageUrl(u) {
  try {
    const p = new URL(u).pathname.replace(/\/+$/, "");
    return p === "" || p === "/" || /^\/(home|index(\.html?)?)$/i.test(p);
  } catch {
    return true;
  }
}
/**
 * Collapse a subpage down to the general location page.
 * Keeps the path up to the deepest segment that contains the city, but if a deeper
 * segment matches the searched service (junk/removal/hauling) it keeps that instead
 * (a service-matched local page is fine). Narrow tails (store IDs, off-service
 * subpages like scrap-metal-disposal) are dropped. Returns null when the URL has no
 * city segment to anchor on.
 */
function deriveGeneralLocationUrl(url, cityNorm) {
  let u;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  const segs = u.pathname.split("/").filter(Boolean);
  if (segs.length === 0 || !cityNorm) return null;

  let cityIdx = -1;
  for (let i = 0; i < segs.length; i++) {
    if (normStr(segs[i]).includes(cityNorm)) cityIdx = i;
  }
  if (cityIdx === -1) return null;

  // Keep a deeper segment only if it's specifically a junk/hauling page (not another
  // service like "furniture-removal" or "scrap-metal-disposal").
  const junkTokens = ["junk", "hauling", "haul"];
  let keepTo = cityIdx;
  for (let j = cityIdx + 1; j < segs.length; j++) {
    if (junkTokens.some((t) => normStr(segs[j]).includes(t))) keepTo = j;
  }
  u.pathname = "/" + segs.slice(0, keepTo + 1).join("/") + "/";
  u.search = "";
  u.hash = "";
  return u.toString();
}

// ---------------------------------------------------------------------------
// DataForSEO
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

/** site:{domain} {city} → top organic result. */
async function siteSearch(domain, city) {
  const keyword = `site:${domain} ${city}`;
  const data = await dfsPost("serp/google/organic/live/advanced", [
    {
      keyword,
      location_name: "United States",
      language_code: "en",
      device: "desktop",
      os: "windows",
      depth: 10,
    },
  ]);
  const items = (data.tasks?.[0]?.result?.[0]?.items ?? []).filter(
    (i) => i.type === "organic" && i.url
  );
  return {
    keyword,
    resultsCount: items.length,
    results: items.slice(0, 10).map((i) => ({
      url: i.url,
      title: i.title ?? null,
      description: i.description ?? null,
      rankAbsolute: i.rank_absolute ?? null,
    })),
  };
}

/** A page is "usable" if it actually loaded with real content. */
function pageIsUsable(page) {
  if (!page?.ok) return false;
  const code = page.statusCode;
  if (code != null && (code < 200 || code >= 400)) return false;
  if ((page.wordCount ?? 0) < 40) return false;
  return true;
}

/** OnPage Instant Pages → structured on-page metrics for one URL. */
async function instantPage(url) {
  const data = await dfsPost("on_page/instant_pages", [
    { url, accept_language: "en-US", load_resources: false, enable_javascript: false },
  ]);
  const item = data.tasks?.[0]?.result?.[0]?.items?.[0];
  if (!item) return { ok: false, error: "no instant_pages item" };
  const meta = item.meta ?? {};
  const h1 = meta.htags?.h1 ?? [];
  const h2 = meta.htags?.h2 ?? [];
  const title = meta.title ?? null;
  const desc = meta.description ?? null;

  const titleL = (title ?? "").toLowerCase();
  const h1L = h1.join(" ").toLowerCase();
  return {
    ok: true,
    url: item.url ?? url,
    statusCode: item.status_code ?? null,
    onpageScore: item.onpage_score ?? null,
    title,
    titleLength: meta.title_length ?? title?.length ?? 0,
    metaDescription: desc,
    h1: h1.slice(0, 5),
    h1Count: h1.length,
    h2Count: h2.length,
    wordCount: meta.content?.plain_text_word_count ?? null,
    canonical: meta.canonical ?? null,
    _titleL: titleL,
    _h1L: h1L,
    _titleN: normStr(title),
    _h1N: normStr(h1.join(" ")),
  };
}

function scoreLocalSignals(page, cityNorm) {
  if (!page?.ok) return page;
  const hasKw = (s) => KW_TOKENS.every((t) => s.includes(t));
  const cityIn = (n) => (cityNorm ? n.includes(cityNorm) : false);
  const out = {
    ...page,
    kwInTitle: hasKw(page._titleL),
    cityInTitle: cityIn(page._titleN),
    kwInH1: hasKw(page._h1L),
    cityInH1: cityIn(page._h1N),
  };
  out.kwCityInTitle = out.kwInTitle && out.cityInTitle;
  out.kwCityInH1 = out.kwInH1 && out.cityInH1;
  delete out._titleL;
  delete out._h1L;
  delete out._titleN;
  delete out._h1N;
  return out;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));

  for (const city of report.report) {
    const cityName = cityFromLabel(city.label);
    const cityNorm = normStr(cityName);
    console.log("\n" + "=".repeat(84));
    console.log(`${city.label}  (city term: "${cityName}")`);
    console.log("=".repeat(84));

    for (const biz of city.businesses) {
      const domain = biz.domain;
      const homepage = biz.website ?? (domain ? `https://${domain}` : null);
      console.log(`\n  #${biz.rank} ${biz.name}  [${domain ?? "no domain"}]`);

      if (!domain) {
        biz.landing = { error: "No domain" };
        continue;
      }

      // 1) site: SERP discovery
      let serp;
      try {
        serp = await siteSearch(domain, cityName);
        console.log(`     site:${domain} "${cityName}" → ${serp.resultsCount} results`);
      } catch (e) {
        biz.landing = { error: `serp: ${e?.message ?? e}` };
        console.log(`     SERP failed: ${biz.landing.error}`);
        continue;
      }
      await sleep(600);

      const top = serp.results[0] ?? null;
      const gbpUrlIsLocal = homepage ? !isHomepageUrl(homepage) : false;
      console.log(
        `     top: ${top?.url ?? "(none)"}${top ? ` (rank ${top.rankAbsolute})` : ""}`
      );

      // Simple rule: take the top site: result. If it's the homepage (or there are no
      // results), the site has no dedicated local page → fall back to the domain.
      // Otherwise collapse an obvious narrow service/store-id tail down to the general
      // location page and audit that one page. If it doesn't load, fall back to the domain.
      let onPageLocal = null;
      let landingUrl = homepage;
      let source = "homepage_fallback";
      let selectionNote = "No dedicated local page ranked first; using homepage.";

      if (top && !isHomepageUrl(top.url)) {
        const general = deriveGeneralLocationUrl(top.url, cityNorm);
        const chosen = general ?? top.url;
        const collapsed = general && normStr(general) !== normStr(top.url);
        let page;
        try {
          page = await instantPage(chosen);
          await sleep(800);
        } catch (e) {
          console.log(`     onPage[local] error: ${e?.message ?? e}`);
        }
        if (pageIsUsable(page)) {
          onPageLocal = scoreLocalSignals(page, cityNorm);
          landingUrl = onPageLocal.url ?? chosen;
          source = collapsed ? "derived_general_page" : "serp_site_search";
          selectionNote = collapsed
            ? "Top result was a narrow subpage; collapsed to the general location page."
            : null;
        } else {
          console.log(
            `     top result not usable (status ${page?.statusCode ?? "?"}, words ${page?.wordCount ?? "?"}) → homepage`
          );
        }
      }

      const dedicatedLocalPage = source !== "homepage_fallback";
      console.log(`     landing: ${landingUrl}  [${source}] localPage=${dedicatedLocalPage}`);
      if (onPageLocal?.ok) {
        console.log(
          `     onPage[local]: "${(onPageLocal.title ?? "").slice(0, 55)}" | ` +
            `kw+city title:${onPageLocal.kwCityInTitle} h1:${onPageLocal.kwCityInH1} | ` +
            `words ${onPageLocal.wordCount ?? "?"}`
        );
      } else {
        console.log(`     onPage[local]: homepage (already audited)`);
      }

      biz.landing = {
        siteSearchQuery: serp.keyword,
        serpResultsCount: serp.resultsCount,
        serpTop: serp.results.slice(0, 3),
        gbpUrlIsLocal,
        dedicatedLocalPage,
        landingUrl,
        source,
        selectionNote,
        onPage: dedicatedLocalPage ? onPageLocal : null,
      };
    }
  }

  report.landingEnrichedAt = new Date().toISOString();
  report.landingMethod =
    "One site:{domain} {city} search (DataForSEO serp/google/organic/live/advanced). Take the top " +
    "result; if it's the homepage or absent, fall back to the domain. Otherwise collapse a narrow " +
    "service/store-id tail to the general location page and audit it via on_page/instant_pages; " +
    "if it doesn't load, fall back to the domain.";

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nUpdated → ${REPORT_PATH}`);

  // summary
  console.log("\n" + "#".repeat(84));
  console.log("LOCAL LANDING PAGE SUMMARY");
  console.log("#".repeat(84));
  for (const city of report.report) {
    console.log(`\n${city.label}`);
    for (const b of city.businesses) {
      const l = b.landing ?? {};
      const op = l.onPage;
      const home = b.onPage ?? {};
      const localCity = op?.ok ? (op.cityInTitle ? "Y" : "n") : "-";
      const homeCity = home?.cityInTitle ? "Y" : "n";
      console.log(
        `  #${b.rank} ${(b.name ?? "").slice(0, 26).padEnd(26)} | ` +
          `${l.dedicatedLocalPage ? "LOCAL" : "home "} | ` +
          `${(l.landingUrl ?? "").replace(/^https?:\/\/(www\.)?/, "").slice(0, 42).padEnd(42)} | ` +
          `city-in-title home:${homeCity} local:${localCity}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
