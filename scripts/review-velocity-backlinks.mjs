/**
 * Enrich review-velocity-report.json with DataForSEO dofollow backlink authority.
 *
 * For each business in the existing report:
 *   1. Resolve website from ScrapingDog Maps search (same pin-anchored query)
 *   2. Fetch top 100 live dofollow backlinks ordered by rank (strongest first)
 *   3. Attach summary authority metrics for comparison with rank / reviews / proximity
 *
 * Usage (PowerShell):
 *   node scripts/review-velocity-backlinks.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const REPORT_PATH = resolve(ROOT, process.env.REPORT_PATH ?? "scripts/review-velocity-report.json");
const BACKLINK_LIMIT = 100;
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

// ---------------------------------------------------------------------------
// domain helpers
// ---------------------------------------------------------------------------
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
// ScrapingDog — resolve website from maps search
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

function norm(s) {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

function matchWebsite(mapsResults, biz) {
  const nameKey = norm(biz.name);

  // 1) exact-ish name match (order can drift between runs, so trust the name)
  const exact = mapsResults.find((r) => norm(r.title) === nameKey);
  if (exact?.website) return { website: exact.website, source: "name_exact" };

  // 2) strong prefix overlap on the name
  const partial = mapsResults.find((r) => {
    const t = norm(r.title);
    if (!t) return false;
    return t.startsWith(nameKey.slice(0, 14)) || nameKey.startsWith(t.slice(0, 14));
  });
  if (partial?.website) return { website: partial.website, source: "name_partial" };

  // 3) last resort: same rank index (only if it doesn't contradict a name)
  const byRank = mapsResults[biz.rank - 1];
  if (byRank?.website) return { website: byRank.website, source: "rank_index" };

  return { website: null, source: "not_found" };
}

// ---------------------------------------------------------------------------
// DataForSEO — dofollow backlinks
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

function normalizeBacklinkItem(item) {
  const attrs = item.attributes ?? [];
  const dofollow =
    item.dofollow === true
      ? true
      : item.dofollow === false
        ? false
        : attrs.includes("nofollow")
          ? false
          : attrs.includes("dofollow")
            ? true
            : null;

  return {
    rank: typeof item.rank === "number" ? item.rank : null,
    domainFrom: item.domain_from ?? null,
    domainFromRank: typeof item.domain_from_rank === "number" ? item.domain_from_rank : null,
    pageFromRank: typeof item.page_from_rank === "number" ? item.page_from_rank : null,
    sourceUrl: item.url_from ?? item.source_url ?? null,
    targetUrl: item.url_to ?? item.target_url ?? null,
    anchor: item.anchor ?? null,
    dofollow,
    firstSeen: item.first_seen ? String(item.first_seen).slice(0, 10) : null,
    lastSeen: item.last_seen ? String(item.last_seen).slice(0, 10) : null,
    spamScore: typeof item.backlink_spam_score === "number" ? item.backlink_spam_score : null,
  };
}

/** Top N live dofollow backlinks, strongest (rank) first. */
async function fetchDofollowBacklinks(domain) {
  const data = await dfsPost("backlinks/backlinks/live", [
    {
      target: domain,
      limit: BACKLINK_LIMIT,
      order_by: ["rank,desc"],
      filters: ["dofollow", "=", true],
      exclude_internal_backlinks: true,
      backlinks_status_type: "live",
      rank_scale: "one_thousand",
    },
  ]);

  const result = data.tasks?.[0]?.result?.[0];
  const rawItems = result?.items ?? [];
  const items = rawItems.map(normalizeBacklinkItem).filter((b) => b.dofollow !== false);

  // enforce strongest-first in case API order drifts
  items.sort((a, b) => (b.rank ?? 0) - (a.rank ?? 0));

  const ranks = items.map((i) => i.rank).filter((r) => r != null);
  const top10 = ranks.slice(0, 10);
  const uniqueDomains = new Set(items.map((i) => i.domainFrom).filter(Boolean));

  return {
    totalDofollowCount: result?.total_count ?? items.length,
    fetched: items.length,
    top100DofollowBacklinks: items.slice(0, BACKLINK_LIMIT),
    summary: {
      strongestLinkRank: ranks[0] ?? null,
      avgTop10LinkRank: top10.length
        ? Math.round((top10.reduce((a, b) => a + b, 0) / top10.length) * 10) / 10
        : null,
      uniqueReferringDomainsInTop100: uniqueDomains.size,
    },
  };
}

function authorityOrder(businesses) {
  const order = new Map();
  const sorted = [...businesses].sort((a, b) => {
    const ar = a.authority?.summary?.strongestLinkRank ?? -1;
    const br = b.authority?.summary?.strongestLinkRank ?? -1;
    if (br !== ar) return br - ar;
    const at = a.authority?.totalDofollowCount ?? 0;
    const bt = b.authority?.totalDofollowCount ?? 0;
    return bt - at;
  });
  sorted.forEach((b, i) => order.set(b, i + 1));
  return order;
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const report = JSON.parse(readFileSync(REPORT_PATH, "utf8"));

  for (const city of report.report) {
    console.log("\n" + "=".repeat(80));
    console.log(`${city.label} — resolving websites`);
    console.log("=".repeat(80));

    const mapsResults = await mapsSearch(city.query, city.searchPoint);
    await sleep(500);

    for (const biz of city.businesses) {
      const { website, source } = matchWebsite(mapsResults, biz);
      const domain = normalizeDomain(website);
      biz.website = website;
      biz.domain = domain;
      biz.websiteSource = source;

      console.log(`\n  #${biz.rank} ${biz.name}`);
      console.log(`     website: ${website ?? "(none)"} → ${domain ?? "(no domain)"}`);

      if (!domain) {
        biz.authority = {
          error: "No website on Maps listing",
          totalDofollowCount: null,
          top100DofollowBacklinks: [],
          summary: null,
        };
        continue;
      }

      try {
        console.log(`     fetching top ${BACKLINK_LIMIT} dofollow backlinks (rank desc)…`);
        const authority = await fetchDofollowBacklinks(domain);
        biz.authority = authority;
        console.log(
          `     → ${authority.totalDofollowCount} total dofollow | ` +
            `top link rank ${authority.summary.strongestLinkRank ?? "?"} | ` +
            `${authority.summary.uniqueReferringDomainsInTop100} unique domains in top ${authority.fetched}`
        );
        if (authority.top100DofollowBacklinks[0]) {
          const top = authority.top100DofollowBacklinks[0];
          console.log(
            `     strongest: ${top.domainFrom} (rank ${top.rank}) → "${(top.anchor ?? "").slice(0, 50)}"`
          );
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`     FAILED: ${msg}`);
        biz.authority = {
          error: msg,
          totalDofollowCount: null,
          top100DofollowBacklinks: [],
          summary: null,
        };
      }

      await sleep(1200);
    }

    const authOrd = authorityOrder(city.businesses);
    for (const biz of city.businesses) {
      biz.authorityOrder = authOrd.get(biz) ?? null;
      console.log(
        `  authority order #${biz.authorityOrder} for rank #${biz.rank} ${biz.name?.slice(0, 28)}`
      );
    }
  }

  report.backlinksEnrichedAt = new Date().toISOString();
  report.backlinkMethod =
    "DataForSEO backlinks/backlinks/live · dofollow=true · order_by rank,desc · top 100 per domain";

  writeFileSync(REPORT_PATH, JSON.stringify(report, null, 2));
  console.log(`\nUpdated → ${REPORT_PATH}`);

  // compact summary table
  console.log("\n" + "#".repeat(80));
  console.log("AUTHORITY SUMMARY (dofollow backlinks)");
  console.log("#".repeat(80));
  for (const city of report.report) {
    console.log(`\n${city.label}`);
    for (const b of city.businesses) {
      const s = b.authority?.summary;
      console.log(
        `  #${b.rank} maps | auth #${b.authorityOrder ?? "?"} | ` +
          `${(b.name ?? "").slice(0, 28).padEnd(28)} | ` +
          `dofollow ${String(b.authority?.totalDofollowCount ?? "?").padStart(6)} | ` +
          `best rank ${String(s?.strongestLinkRank ?? "?").padStart(4)} | ` +
          `domains ${String(s?.uniqueReferringDomainsInTop100 ?? "?").padStart(3)} | ` +
          `maps dist ${b.distanceMi}mi | 90d rev ${b.reviews90d}`
      );
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
