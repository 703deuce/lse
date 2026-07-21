/**
 * Capture Maps Scan pages with true top-to-bottom scroll segments.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/maps-scan";
const URL = "http://localhost:3000/dev/grid-rank-preview";
const VIEWPORT = { width: 1440, height: 600 };
const OVERLAP = 80;

const VIEWS = [
  { label: "Rank Grid", slug: "01-rank-grid", button: "Rank Grid" },
  { label: "Scans hub", slug: "02-scans-hub", button: "Scans hub" },
];

function md5(file) {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

async function getScrollMetrics(page) {
  return page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    // Prefer main scrollable panel if present
    const main = document.querySelector("main");
    const candidates = [el, document.body, main].filter(Boolean);
    let best = el;
    let bestH = 0;
    for (const c of candidates) {
      const h = Math.max(c.scrollHeight || 0, c.clientHeight || 0);
      if (h > bestH) {
        bestH = h;
        best = c;
      }
    }
    const scrollY =
      best === el || best === document.documentElement || best === document.body
        ? window.scrollY || el.scrollTop || 0
        : best.scrollTop || 0;
    return {
      scrollY,
      clientHeight: best.clientHeight || window.innerHeight,
      scrollHeight: Math.max(
        best.scrollHeight || 0,
        el.scrollHeight,
        document.body?.scrollHeight || 0,
        document.documentElement.scrollHeight
      ),
      target: best === el || best === document.documentElement || best === document.body ? "window" : "main",
    };
  });
}

async function scrollToY(page, y) {
  await page.evaluate((target) => {
    window.scrollTo({ top: target, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = target;
    document.body.scrollTop = target;
    const main = document.querySelector("main");
    if (main) main.scrollTop = target;
  }, y);
  await page.waitForTimeout(450);
}

async function captureView(page, view) {
  const tabDir = path.join(OUT, view.slug);
  fs.mkdirSync(tabDir, { recursive: true });

  await page.getByRole("button", { name: view.button, exact: true }).click();
  await page.waitForTimeout(3500);
  await scrollToY(page, 0);
  await page.waitForTimeout(600);

  // Wait for map/tiles or hub content
  await page.waitForTimeout(1500);

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
    const after = await getScrollMetrics(page);
    const file = path.join(
      tabDir,
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
  const fullFile = path.join(tabDir, "full-page.png");
  await page.screenshot({ path: fullFile, fullPage: true });

  const hashes = new Set(segments.map((s) => s.md5));
  return {
    view: view.label,
    slug: view.slug,
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
  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(4000);

  const h1 = await page.locator("h1").first().textContent().catch(() => null);
  console.log("page h1:", h1);

  const results = [];
  for (const view of VIEWS) {
    console.log("\n=== Capturing", view.label, "===");
    const result = await captureView(page, view);
    results.push(result);
    console.log(
      JSON.stringify(
        {
          view: result.view,
          scrollHeight: result.scrollHeight,
          segmentCount: result.segmentCount,
          scrollYs: result.segments.map((s) => s.scrollY),
          allHashesUnique: result.allHashesUnique,
        },
        null,
        2
      )
    );
  }

  await browser.close();

  const index = {
    capturedAt: new Date().toISOString(),
    url: URL,
    viewport: VIEWPORT,
    note: "Filenames include scrollY. Hashes verified unique when multiple segments exist. full-page.png is entire view.",
    views: results,
  };
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
  console.log("\nWrote", path.join(OUT, "index.json"));

  const bad = results.filter((r) => r.maxY > 100 && !r.allHashesUnique);
  if (bad.length) {
    console.error("FAILED uniqueness for:", bad.map((b) => b.view));
    process.exit(1);
  }
  console.log("OK: all long views have unique viewport hashes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
