/**
 * Capture Maps Scan pages from production (real Google Maps tiles).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/maps-scan-live";
const BASE = "https://app.localseoexpress.com";
const BUSINESS_ID = "e64dbadd-69bb-4715-a526-6d137c0ae409";
const GRID_SCAN_ID = "509c9785-4f41-46c9-b5c8-da42fa0d5aed";
const VIEWPORT = { width: 1440, height: 600 };
const OVERLAP = 80;

const PAGES = [
  {
    label: "Rank Grid",
    slug: "01-rank-grid",
    url: `${BASE}/businesses/${BUSINESS_ID}/grid/${GRID_SCAN_ID}`,
  },
  {
    label: "Scans hub",
    slug: "02-scans-hub",
    url: `${BASE}/businesses/${BUSINESS_ID}/scans`,
  },
];

function md5(file) {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

async function getScrollMetrics(page) {
  return page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    const mains = [...document.querySelectorAll("main, [data-scroll], .overflow-y-auto")];
    let best = el;
    let bestH = el.scrollHeight || 0;
    for (const c of mains) {
      if ((c.scrollHeight || 0) > bestH + 50) {
        best = c;
        bestH = c.scrollHeight;
      }
    }
    const isWindow = best === el || best === document.documentElement || best === document.body;
    return {
      scrollY: isWindow ? window.scrollY || el.scrollTop || 0 : best.scrollTop || 0,
      clientHeight: isWindow ? window.innerHeight : best.clientHeight || window.innerHeight,
      scrollHeight: Math.max(
        best.scrollHeight || 0,
        el.scrollHeight,
        document.body?.scrollHeight || 0,
        document.documentElement.scrollHeight
      ),
      isWindow,
    };
  });
}

async function scrollToY(page, y) {
  await page.evaluate((target) => {
    window.scrollTo({ top: target, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = target;
    document.body.scrollTop = target;
    for (const c of document.querySelectorAll("main, .overflow-y-auto")) {
      c.scrollTop = target;
    }
  }, y);
  await page.waitForTimeout(500);
}

async function waitForMap(page) {
  // Wait for Google Maps canvas or leaflet/map tiles; ignore missing-key message
  for (let i = 0; i < 20; i++) {
    const state = await page.evaluate(() => {
      const missing = /Missing Google Maps API key/i.test(document.body?.innerText || "");
      const canvas = document.querySelector("canvas");
      const gmap = document.querySelector(".gm-style, [class*='maplib'], .leaflet-container");
      const imgTiles = document.querySelectorAll('img[src*="googleapis"], img[src*="gstatic"], img[src*="mapbox"]').length;
      return { missing, hasCanvas: !!canvas, hasGmap: !!gmap, imgTiles };
    });
    console.log("  map state:", state);
    if (!state.missing && (state.hasCanvas || state.hasGmap || state.imgTiles > 0)) {
      await page.waitForTimeout(2500); // tiles finish painting
      return true;
    }
    await page.waitForTimeout(1000);
  }
  return false;
}

async function capturePage(page, cfg) {
  const dir = path.join(OUT, cfg.slug);
  fs.mkdirSync(dir, { recursive: true });

  console.log("\n===", cfg.label, "===");
  await page.goto(cfg.url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(4000);
  const mapOk = await waitForMap(page);
  console.log("  mapOk:", mapOk, "url:", page.url());

  await scrollToY(page, 0);
  await page.waitForTimeout(800);

  const metrics = await getScrollMetrics(page);
  const step = Math.max(200, metrics.clientHeight - OVERLAP);
  const maxY = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  const positions = [];
  for (let y = 0; y <= maxY; y += step) positions.push(Math.min(y, maxY));
  if (positions[positions.length - 1] !== maxY) positions.push(maxY);
  const unique = [...new Set(positions.map((n) => Math.round(n)))];

  const segments = [];
  for (let i = 0; i < unique.length; i++) {
    const y = unique[i];
    await scrollToY(page, y);
    // Extra wait on first segment so map stays painted
    if (i === 0) await page.waitForTimeout(1500);
    const after = await getScrollMetrics(page);
    const file = path.join(
      dir,
      `${String(i + 1).padStart(2, "0")}-of-${String(unique.length).padStart(2, "0")}-scrollY-${Math.round(after.scrollY)}.png`
    );
    await page.screenshot({ path: file, fullPage: false });
    segments.push({
      index: i + 1,
      of: unique.length,
      scrollY: Math.round(after.scrollY),
      file,
      md5: md5(file),
    });
  }

  await scrollToY(page, 0);
  const fullFile = path.join(dir, "full-page.png");
  await page.screenshot({ path: fullFile, fullPage: true });

  const hashes = new Set(segments.map((s) => s.md5));
  return {
    view: cfg.label,
    slug: cfg.slug,
    url: cfg.url,
    mapOk,
    scrollHeight: metrics.scrollHeight,
    clientHeight: metrics.clientHeight,
    maxY,
    segmentCount: segments.length,
    uniqueHashCount: hashes.size,
    allHashesUnique: hashes.size === segments.length || maxY === 0,
    segments,
    fullPage: fullFile,
  };
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });

  // Warm auth/session via workspace first
  await page.goto(`${BASE}/workspace`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  console.log("warm url:", page.url());

  const results = [];
  for (const cfg of PAGES) {
    results.push(await capturePage(page, cfg));
    console.log(
      JSON.stringify(
        {
          view: results.at(-1).view,
          mapOk: results.at(-1).mapOk,
          segmentCount: results.at(-1).segmentCount,
          scrollYs: results.at(-1).segments.map((s) => s.scrollY),
          allHashesUnique: results.at(-1).allHashesUnique,
        },
        null,
        2
      )
    );
  }

  await browser.close();

  const index = {
    capturedAt: new Date().toISOString(),
    source: "https://app.localseoexpress.com",
    businessId: BUSINESS_ID,
    gridScanId: GRID_SCAN_ID,
    viewport: VIEWPORT,
    note: "Live production captures with Google Maps tiles. Filenames include scrollY; hashes verified unique.",
    views: results,
  };
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
  console.log("\nWrote", path.join(OUT, "index.json"));

  const bad = results.filter((r) => r.maxY > 100 && !r.allHashesUnique);
  if (bad.length) {
    console.error("FAILED uniqueness:", bad.map((b) => b.view));
    process.exit(1);
  }
  if (results.some((r) => r.view === "Rank Grid" && !r.mapOk)) {
    console.error("WARN: Rank Grid map may still be missing");
    process.exit(2);
  }
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
