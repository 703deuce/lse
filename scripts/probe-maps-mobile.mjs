/**
 * Probe DataForSEO Maps Live for mobile vs desktop on failing grid cells.
 * Usage: node scripts/probe-maps-mobile.mjs
 */
import { readFileSync } from "fs";
import { resolve } from "path";

function loadEnv() {
  const path = resolve(process.cwd(), ".env.local");
  const text = readFileSync(path, "utf8");
  for (const line of text.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim().replace(/^["']|["']$/g, "");
  }
}

loadEnv();

const USER = process.env.DATAFORSEO_USERNAME;
const PASS = process.env.DATAFORSEO_PASSWORD;
if (!USER || !PASS) {
  console.error("Missing DATAFORSEO_USERNAME/PASSWORD in .env.local");
  process.exit(1);
}

const auth = "Basic " + Buffer.from(`${USER}:${PASS}`).toString("base64");
const KEYWORD = "junk removal woodbridge";

/** Cells that fail on mobile but succeed on desktop */
const CELLS = [
  { label: "C1", lat: 38.6631142331807, lng: -77.4445056776467 },
  { label: "A3", lat: 38.7355192096283, lng: -77.3518246 },
  { label: "E1", lat: 38.5907459181363, lng: -77.4444121850394 },
  { label: "D3", lat: 38.6269665951859, lng: -77.3518246 }, // control — mobile succeeds
];

const VARIANTS = [
  { name: "current-mobile", body: (c, z) => ({ keyword: KEYWORD, location_coordinate: `${c.lat},${c.lng},${z}`, language_code: "en", device: "mobile", os: "android", browser: "chrome", depth: 50 }) },
  { name: "mobile-no-browser", body: (c, z) => ({ keyword: KEYWORD, location_coordinate: `${c.lat},${c.lng},${z}`, language_code: "en", device: "mobile", os: "android", depth: 50 }) },
  { name: "mobile-search_places-false", body: (c, z) => ({ keyword: KEYWORD, location_coordinate: `${c.lat},${c.lng},${z}`, language_code: "en", device: "mobile", os: "android", depth: 50, search_places: false }) },
  { name: "mobile-search_this_area-false", body: (c, z) => ({ keyword: KEYWORD, location_coordinate: `${c.lat},${c.lng},${z}`, language_code: "en", device: "mobile", os: "android", depth: 50, search_this_area: false }) },
  { name: "mobile-both-flags-false", body: (c, z) => ({ keyword: KEYWORD, location_coordinate: `${c.lat},${c.lng},${z}`, language_code: "en", device: "mobile", os: "android", depth: 50, search_places: false, search_this_area: false }) },
  { name: "desktop-baseline", body: (c, z) => ({ keyword: KEYWORD, location_coordinate: `${c.lat},${c.lng},${z}`, language_code: "en", device: "desktop", os: "windows", depth: 50 }) },
  { name: "mobile-depth-20", body: (c, z) => ({ keyword: KEYWORD, location_coordinate: `${c.lat},${c.lng},${z}`, language_code: "en", device: "mobile", os: "android", depth: 20 }) },
];

async function call(body) {
  const res = await fetch("https://api.dataforseo.com/v3/serp/google/maps/live/advanced", {
    method: "POST",
    headers: { Authorization: auth, "Content-Type": "application/json" },
    body: JSON.stringify([body]),
  });
  const data = await res.json();
  const task = data.tasks?.[0];
  const result = task?.result?.[0];
  return {
    taskStatus: task?.status_code,
    taskMessage: task?.status_message,
    itemCount: result?.items_count ?? result?.items?.length ?? 0,
    seResultsCount: result?.se_results_count ?? null,
    checkUrl: result?.check_url?.slice(0, 80) ?? null,
  };
}

async function main() {
  for (const cell of CELLS) {
    console.log(`\n${"=".repeat(60)}\nCELL ${cell.label} (${cell.lat}, ${cell.lng})\n${"=".repeat(60)}`);
    for (const zoom of [14, 17]) {
      console.log(`\n  --- zoom ${zoom} ---`);
      for (const variant of VARIANTS) {
        try {
          const r = await call(variant.body(cell, zoom));
          const ok = r.taskStatus === 20000 && r.itemCount > 0;
          console.log(
            `  ${variant.name.padEnd(32)} status=${r.taskStatus} items=${r.itemCount} se_count=${r.seResultsCount} ${ok ? "OK" : "FAIL"}`
          );
        } catch (e) {
          console.log(`  ${variant.name.padEnd(32)} ERROR ${e.message}`);
        }
        await new Promise((r) => setTimeout(r, 400));
      }
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
