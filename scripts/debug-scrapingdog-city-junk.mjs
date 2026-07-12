/**
 * Debug ScrapingDog for "city junk removal service" (Woodbridge VA).
 *
 * Usage (PowerShell):
 *   node scripts/debug-scrapingdog-city-junk.mjs
 */

import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");

const TARGET = {
  name: "city junk removal service",
  placeId: "ChIJm3TJc3ZXtokR94B6W1KYUjw",
  dfsNumericCid: "4346704069855445239",
  city: "Woodbridge",
  state: "VA",
};

const SORT_OPTIONS = ["newestFirst", "qualityScore", "ratingHigh", "ratingLow"];

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

function section(title) {
  console.log("\n" + "=".repeat(72));
  console.log(title);
  console.log("=".repeat(72));
}

function preview(value, max = 600) {
  try {
    return JSON.stringify(value, null, 2).slice(0, max);
  } catch {
    return String(value).slice(0, max);
  }
}

async function sdGet(path, params) {
  const url = new URL(`https://api.scrapingdog.com/${path}`);
  url.searchParams.set("api_key", API_KEY);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const start = Date.now();
  const res = await fetch(url.toString());
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = { raw: text.slice(0, 800) };
  }
  return {
    ok: res.ok,
    status: res.status,
    latencyMs: Date.now() - start,
    params,
    body,
  };
}

function extractDataIdFromPlaceDetails(details) {
  const placeResults = details?.place_results;
  const candidates = [
    placeResults?.data_id,
    details?.data_id,
    details?.place?.data_id,
  ];
  for (const c of candidates) {
    if (typeof c === "string" && c.startsWith("0x") && c.includes(":")) return c;
  }
  return null;
}

function extractReviewDates(reviews) {
  if (!Array.isArray(reviews)) return [];
  return reviews.slice(0, 5).map((r, i) => ({
    i,
    rating: r.rating ?? r.stars,
    date: r.date ?? r.review_date ?? r.published_at ?? r.relative_date ?? r.when,
    snippet: (r.snippet ?? r.text ?? r.review_text ?? "").slice(0, 80),
  }));
}

async function tryReviews(label, dataId, sortBy) {
  const result = await sdGet("google_maps/reviews", {
    data_id: dataId,
    sort_by: sortBy,
  });
  const reviews = result.body?.reviews_results ?? result.body?.reviews ?? [];
  console.log(`\n  [reviews] ${label} | sort=${sortBy} | HTTP ${result.status} | ${result.latencyMs}ms`);
  if (!result.ok) {
    console.log("  error:", preview(result.body, 300));
    return { ok: false, sortBy, count: 0 };
  }
  console.log("  reviewCount:", Array.isArray(reviews) ? reviews.length : 0);
  if (Array.isArray(reviews) && reviews.length) {
    console.log("  sampleDates:", preview(extractReviewDates(reviews), 500));
  }
  return { ok: true, sortBy, count: Array.isArray(reviews) ? reviews.length : 0, reviews };
}

async function tryAllSorts(label, dataId) {
  const results = [];
  for (const sortBy of SORT_OPTIONS) {
    results.push(await tryReviews(label, dataId, sortBy));
    await sleep(400);
  }
  return results;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function main() {
  console.log("ScrapingDog debug — city junk removal service");
  console.log("Target:", TARGET);

  section("1) place_details (place_id)");
  const detailsRes = await sdGet("google_maps/places", { place_id: TARGET.placeId });
  console.log("HTTP", detailsRes.status, `(${detailsRes.latencyMs}ms)`);
  if (!detailsRes.ok) {
    console.log("FAILED:", preview(detailsRes.body, 400));
  } else {
    const pr = detailsRes.body?.place_results ?? detailsRes.body;
    console.log("title:", pr?.title ?? pr?.name);
    console.log("address:", pr?.address ?? pr?.formatted_address);
    console.log("rating:", pr?.rating, "| reviews:", pr?.reviews ?? pr?.review_count);
    console.log("data_id (place_results):", pr?.data_id);
    console.log("cid field:", pr?.cid ?? pr?.place_id);
    const dataIdFromDetails = extractDataIdFromPlaceDetails(detailsRes.body);
    console.log("extracted data_id:", dataIdFromDetails);

    if (dataIdFromDetails) {
      section("2) reviews API — data_id from place_details");
      await tryAllSorts("place_details data_id", dataIdFromDetails);
    }
  }

  section("3) maps_search — geo-qualified queries");
  const queries = [
    `${TARGET.name} ${TARGET.city} ${TARGET.state}`,
    `${TARGET.name} ${TARGET.city}`,
    `${TARGET.name} Woodbridge Virginia`,
    TARGET.name,
  ];

  const searchDataIds = new Set();
  for (const query of queries) {
    const searchRes = await sdGet("google_maps", { query });
    const results = Array.isArray(searchRes.body)
      ? searchRes.body
      : searchRes.body?.search_results ?? [];
    const match = results.find((r) => r.place_id === TARGET.placeId);
    console.log(`\n  query: "${query}"`);
    console.log(`  HTTP ${searchRes.status} | results: ${results.length}`);
    if (match) {
      console.log("  MATCH by place_id:", {
        title: match.title,
        place_id: match.place_id,
        data_id: match.data_id,
        address: match.address,
      });
      if (match.data_id?.startsWith("0x")) searchDataIds.add(match.data_id);
    } else {
      console.log(
        "  no place_id match. top 3:",
        preview(
          results.slice(0, 3).map((r) => ({
            title: r.title,
            place_id: r.place_id,
            data_id: r.data_id,
            address: r.address,
          })),
          500
        )
      );
    }
    await sleep(400);
  }

  for (const dataId of searchDataIds) {
    section(`4) reviews API — data_id from maps_search: ${dataId}`);
    await tryAllSorts("maps_search data_id", dataId);
  }

  section("5) reviews API — numeric DFS CID (expected to fail)");
  for (const sortBy of ["qualityScore", "newestFirst"]) {
    const cidRes = await sdGet("google_maps/reviews", {
      data_id: TARGET.dfsNumericCid,
      sort_by: sortBy,
    });
    console.log(`\n  numeric cid as data_id | sort=${sortBy} | HTTP ${cidRes.status}`);
    console.log("  ", preview(cidRes.body, 250));
    await sleep(400);
  }

  section("6) place_details — raw keys (for ScrapingDog support ticket)");
  if (detailsRes.ok) {
    console.log("top-level keys:", Object.keys(detailsRes.body ?? {}));
    const pr = detailsRes.body?.place_results;
    if (pr && typeof pr === "object") {
      console.log("place_results keys:", Object.keys(pr));
    }
  }

  section("SUMMARY");
  console.log(`
What we know:
- place_id ${TARGET.placeId} resolves via place_details and returns a hex data_id.
- If ALL sort options return HTTP 400 on reviews, ScrapingDog's reviews endpoint
  does not support this listing even though place_details works.
- If maps_search never returns place_id match for Woodbridge queries, we cannot
  get an alternate data_id from search.
- Numeric CID (${TARGET.dfsNumericCid}) is NOT a valid reviews data_id parameter.

Next steps if reviews 400 persists:
- Contact ScrapingDog with place_id + data_id + "reviews returns 400"
- Or accept this listing cannot be used for Review Momentum
`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
