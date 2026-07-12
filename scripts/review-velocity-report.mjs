/**
 * Review Velocity + Proximity Report — top 3 junk removal players per city.
 *
 * For each city we set an explicit search point (the "pin"), run a ScrapingDog
 * Maps search anchored at that pin, take the top 3 results, then measure:
 *   - review velocity (30 / 90 / 365 day dated review counts)
 *   - distance from the search pin (Haversine, miles)
 *   - within-pack ordering by proximity and by 90d velocity
 *
 * This lets us separate proximity influence from review influence on rank.
 *
 * Usage (PowerShell):
 *   node scripts/review-velocity-report.mjs
 */

import { readFileSync, writeFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

// searchPoint = the pin the search is anchored to (approx. city center / downtown).
const ALL_CITIES = [
  { label: "Woodbridge, VA (baseline)", query: "junk removal woodbridge va", searchPoint: { lat: 38.6582, lng: -77.2497 } },
  { label: "Winchester, VA", query: "junk removal winchester va", searchPoint: { lat: 39.1857, lng: -78.1633 } },
  { label: "Baltimore, MD", query: "junk removal baltimore md", searchPoint: { lat: 39.2904, lng: -76.6122 } },
  { label: "Miami, FL", query: "junk removal miami fl", searchPoint: { lat: 25.7617, lng: -80.1918 } },
  { label: "Los Angeles, CA", query: "junk removal los angeles ca", searchPoint: { lat: 34.0522, lng: -118.2437 } },
  { label: "Denver, CO", query: "junk removal denver co", searchPoint: { lat: 39.7392, lng: -104.9903 } },
  { label: "Nashville, TN", query: "junk removal nashville tn", searchPoint: { lat: 36.1627, lng: -86.7816 } },
  { label: "Phoenix, AZ", query: "junk removal phoenix az", searchPoint: { lat: 33.4484, lng: -112.074 } },
];

// CITY_FILTER (comma-separated substrings) limits which cities run this pass.
const CITY_FILTER = process.env.CITY_FILTER
  ? process.env.CITY_FILTER.split(",").map((s) => s.trim().toLowerCase()).filter(Boolean)
  : null;
const CITIES = CITY_FILTER
  ? ALL_CITIES.filter((c) => CITY_FILTER.some((f) => c.label.toLowerCase().includes(f)))
  : ALL_CITIES;

const TOP_N = 3;
const LOOKBACK_DAYS = 365;
const MAX_REVIEW_PAGES = 40;
const SEARCH_ZOOM = 12; // wider zoom so top ranked results near the pin surface

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

const API_KEY = process.env.SCRAPINGDOG_API_KEY ?? process.env.SCRAPING_DOG_API_KEY;
if (!API_KEY) {
  console.error("Missing SCRAPINGDOG_API_KEY in .env.local");
  process.exit(1);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const DAY_MS = 24 * 60 * 60 * 1000;

async function sdGet(path, params) {
  const url = new URL(`https://api.scrapingdog.com/${path}`);
  url.searchParams.set("api_key", API_KEY);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 500) };
  }
  return { ok: res.ok, status: res.status, body };
}

/** Great-circle distance in miles. */
function haversineMiles(a, b) {
  if (a?.lat == null || a?.lng == null || b?.lat == null || b?.lng == null) return null;
  const R = 3958.7613;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)) * 100) / 100;
}

function extractCoords(r) {
  const g = r.gps_coordinates ?? r.coordinates ?? {};
  const lat = g.latitude ?? g.lat ?? r.latitude ?? r.lat;
  const lng = g.longitude ?? g.lng ?? r.longitude ?? r.lng;
  if (typeof lat === "number" && typeof lng === "number") return { lat, lng };
  const nlat = Number(lat);
  const nlng = Number(lng);
  if (Number.isFinite(nlat) && Number.isFinite(nlng)) return { lat: nlat, lng: nlng };
  return { lat: null, lng: null };
}

// ---- review dating ----
function parseReviewDate(raw, now) {
  const iso = raw.iso_date ?? raw.review_date ?? raw.published_at;
  if (typeof iso === "string") {
    const d = new Date(iso);
    if (!Number.isNaN(d.getTime())) return d;
  }
  if (typeof raw.timestamp === "number") {
    const ms = raw.timestamp > 1e12 ? raw.timestamp : raw.timestamp * 1000;
    const d = new Date(ms);
    if (!Number.isNaN(d.getTime())) return d;
  }
  const rel = raw.relative_date ?? raw.date ?? raw.when;
  if (typeof rel === "string") return parseRelative(rel, now);
  return null;
}

function parseRelative(text, now) {
  const t = text.toLowerCase().trim();
  const m = t.match(/(a|an|\d+)\s*(second|minute|hour|day|week|month|year)s?\s*ago/);
  if (!m) return null;
  const n = m[1] === "a" || m[1] === "an" ? 1 : parseInt(m[1], 10);
  const mult = {
    second: 1000,
    minute: 60 * 1000,
    hour: 60 * 60 * 1000,
    day: DAY_MS,
    week: 7 * DAY_MS,
    month: 30 * DAY_MS,
    year: 365 * DAY_MS,
  }[m[2]];
  return new Date(now.getTime() - n * mult);
}

async function fetchDatedReviews(dataId) {
  const now = new Date();
  const cutoff = now.getTime() - LOOKBACK_DAYS * DAY_MS;
  const dates = [];
  let unparsed = 0;
  let nextToken = null;
  let pages = 0;
  let sortBy = "newestFirst";
  let stoppedReason = "no_more_pages";

  for (let page = 0; page < MAX_REVIEW_PAGES; page++) {
    const params = { data_id: dataId, sort_by: sortBy };
    if (nextToken) {
      params.next_page_token = nextToken;
      params.results = "20";
    }
    let res = await sdGet("google_maps/reviews", params);
    if (!res.ok && page === 0 && sortBy === "newestFirst") {
      sortBy = "qualityScore";
      res = await sdGet("google_maps/reviews", { data_id: dataId, sort_by: sortBy });
    }
    if (!res.ok) {
      stoppedReason = `http_${res.status}`;
      break;
    }
    pages++;
    const batch = res.body?.reviews_results ?? res.body?.reviews ?? [];
    if (!Array.isArray(batch) || batch.length === 0) {
      stoppedReason = "empty_page";
      break;
    }
    let oldestOnPage = null;
    for (const r of batch) {
      const d = parseReviewDate(r, now);
      if (!d) {
        unparsed++;
        continue;
      }
      dates.push(d.getTime());
      if (oldestOnPage == null || d.getTime() < oldestOnPage) oldestOnPage = d.getTime();
    }
    if (sortBy === "newestFirst" && oldestOnPage != null && oldestOnPage < cutoff) {
      stoppedReason = "lookback_reached";
      break;
    }
    nextToken = res.body?.pagination?.next_page_token ?? null;
    if (!nextToken) {
      stoppedReason = "no_more_pages";
      break;
    }
    await sleep(350);
  }
  if (pages >= MAX_REVIEW_PAGES) stoppedReason = "max_pages";

  const count = (days) => {
    const c = now.getTime() - days * DAY_MS;
    return dates.filter((t) => t >= c).length;
  };
  const newest = dates.length ? Math.max(...dates) : null;
  return {
    sortBy,
    pages,
    stoppedReason,
    unparsed,
    datedFetched: dates.length,
    reviews30d: count(30),
    reviews90d: count(90),
    reviews365d: count(365),
    daysSinceLast: newest == null ? null : Math.floor((now.getTime() - newest) / DAY_MS),
    newestIso: newest ? new Date(newest).toISOString().slice(0, 10) : null,
  };
}

async function mapsSearch(query, searchPoint) {
  const params = { query };
  if (searchPoint) params.ll = `@${searchPoint.lat},${searchPoint.lng},${SEARCH_ZOOM}z`;
  const res = await sdGet("google_maps", params);
  if (!res.ok) return [];
  return Array.isArray(res.body) ? res.body : res.body?.search_results ?? [];
}

/** Assign 1-based order (1 = best) for a numeric key; higher/lower configurable. */
function rankOrder(items, valueOf, dir) {
  const sorted = [...items].sort((a, b) => {
    const av = valueOf(a);
    const bv = valueOf(b);
    if (av == null) return 1;
    if (bv == null) return -1;
    return dir === "asc" ? av - bv : bv - av;
  });
  const order = new Map();
  sorted.forEach((it, i) => order.set(it, i + 1));
  return order;
}

function classify(b, top1) {
  if (b.rank === 1) return "Anchor (#1)";
  if (b.distanceMi == null || top1.distanceMi == null) return "Unknown (no coords)";
  const closer = b.distanceMi < top1.distanceMi;
  const betterReviews = b.reviews90d > top1.reviews90d;
  // b always ranks below #1 here
  if (closer && betterReviews) return "Closer+better yet lower — anomaly, check relevance";
  if (closer && !betterReviews) return "Closer but weaker reviews — proximity not enough alone";
  if (!closer && betterReviews) return "Farther+better but lower — proximity may be blocking it";
  return "Farther+weaker — rank is consistent (both favor #1)";
}

// ---------------------------------------------------------------------------
// main
// ---------------------------------------------------------------------------
async function main() {
  const report = [];

  for (const city of CITIES) {
    console.log("\n" + "=".repeat(84));
    console.log(`CITY: ${city.label}  —  pin @ ${city.searchPoint.lat},${city.searchPoint.lng}`);
    console.log("=".repeat(84));

    const results = await mapsSearch(city.query, city.searchPoint);
    const top = results.filter((r) => r.data_id?.startsWith("0x")).slice(0, TOP_N);

    if (top.length === 0) {
      console.log("  No usable results (no hex data_id).");
      report.push({ ...city, businesses: [] });
      continue;
    }

    const businesses = [];
    for (let i = 0; i < top.length; i++) {
      const b = top[i];
      const coords = extractCoords(b);
      const distanceMi = haversineMiles(city.searchPoint, coords);
      console.log(
        `\n  #${i + 1} ${b.title}  |  rating ${b.rating ?? "?"} (${b.reviews ?? "?"} reviews)  |  ` +
          `dist ${distanceMi ?? "?"} mi`
      );
      const vel = await fetchDatedReviews(b.data_id);
      console.log(
        `     velocity → 30d ${vel.reviews30d} | 90d ${vel.reviews90d} | 365d ${vel.reviews365d} | ` +
          `newest ${vel.newestIso ?? "n/a"} (${vel.daysSinceLast ?? "?"}d)`
      );
      businesses.push({
        rank: i + 1,
        name: b.title,
        rating: b.rating ?? null,
        totalReviews: b.reviews ?? null,
        lat: coords.lat,
        lng: coords.lng,
        searchPointLat: city.searchPoint.lat,
        searchPointLng: city.searchPoint.lng,
        distanceFromSearchPointMiles: distanceMi,
        distanceMi,
        ...vel,
      });
      await sleep(400);
    }

    // within-pack orderings
    const proxOrder = rankOrder(businesses, (x) => x.distanceMi, "asc");
    const revOrder = rankOrder(businesses, (x) => x.reviews90d, "desc");
    const top1 = businesses.find((x) => x.rank === 1);
    for (const b of businesses) {
      b.proximityOrder = proxOrder.get(b);
      b.reviewOrder90d = revOrder.get(b);
      b.classification = classify(b, top1);
      console.log(
        `     rank #${b.rank} | closest #${b.proximityOrder} | reviews #${b.reviewOrder90d} → ${b.classification}`
      );
    }

    report.push({ ...city, businesses });
    await sleep(600);
  }

  // ---- summary ----
  console.log("\n\n" + "#".repeat(84));
  console.log("SUMMARY — rank vs proximity vs 90d velocity");
  console.log("#".repeat(84));
  for (const c of report) {
    console.log(`\n${c.label}`);
    for (const b of c.businesses) {
      console.log(
        `   #${b.rank} ${(b.name ?? "").slice(0, 30).padEnd(30)} ` +
          `dist ${String(b.distanceMi ?? "?").padStart(5)}mi (closest #${b.proximityOrder}) | ` +
          `90d ${String(b.reviews90d).padStart(3)} (rev #${b.reviewOrder90d}) | ${b.classification}`
      );
    }
  }

  const outPath = resolve(ROOT, process.env.REPORT_OUT ?? "scripts/review-velocity-report.json");
  writeFileSync(outPath, JSON.stringify({ generatedAt: new Date().toISOString(), report }, null, 2));
  console.log(`\nSaved raw data → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
