/**
 * Capture Reports screens from production — top-to-bottom scroll segments.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/reports";
const BASE = "https://app.localseoexpress.com";
const BUSINESS_ID = "e64dbadd-69bb-4715-a526-6d137c0ae409";
const VIEWPORT = { width: 1440, height: 700 };
const OVERLAP = 80;

const PAGES = [
  {
    label: "Org Reports",
    slug: "01-org-reports",
    url: `${BASE}/reports`,
    waitText: "Reports",
  },
  {
    label: "Business Reports Hub",
    slug: "02-business-reports",
    url: `${BASE}/businesses/${BUSINESS_ID}/reports`,
    waitText: "Report",
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
    const isWindow =
      best === el || best === document.documentElement || best === document.body;
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

async function capturePage(page, cfg) {
  const dir = path.join(OUT, cfg.slug);
  fs.mkdirSync(dir, { recursive: true });

  console.log("\n===", cfg.label, "===");
  await page.goto(cfg.url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3500);
  await page.waitForSelector(`text=${cfg.waitText}`, { timeout: 60000 }).catch(() => {});
  await page.waitForTimeout(2000);
  console.log("  url:", page.url());

  await scrollToY(page, 0);
  await page.waitForTimeout(600);

  const metrics = await getScrollMetrics(page);
  const step = Math.max(280, metrics.clientHeight - OVERLAP);
  const maxY = Math.max(0, metrics.scrollHeight - metrics.clientHeight);

  const positions = [0];
  if (maxY > 200) {
    for (let y = step; y < maxY; y += step) positions.push(Math.min(y, maxY));
  }
  if (maxY > 40 && positions[positions.length - 1] !== maxY) positions.push(maxY);

  // Drop near-duplicates
  const unique = [];
  for (const y of positions) {
    if (!unique.length || Math.abs(y - unique[unique.length - 1]) >= 60) unique.push(y);
  }

  const segments = [];
  for (let i = 0; i < unique.length; i++) {
    const y = unique[i];
    await scrollToY(page, y);
    const after = await getScrollMetrics(page);
    const name = `${String(i + 1).padStart(2, "0")}-of-${String(unique.length).padStart(2, "0")}-scrollY-${Math.round(after.scrollY)}.png`;
    const file = path.join(dir, name);
    await page.screenshot({ path: file, fullPage: false });
    const hash = md5(file);
    segments.push({
      index: i + 1,
      of: unique.length,
      scrollY: Math.round(after.scrollY),
      file: name,
      path: file,
      md5: hash,
    });
    console.log(" ", name, "md5=", hash);
  }

  const hashes = new Set(segments.map((s) => s.md5));
  return {
    view: cfg.label,
    slug: cfg.slug,
    url: cfg.url,
    scrollHeight: metrics.scrollHeight,
    clientHeight: metrics.clientHeight,
    maxY,
    segmentCount: segments.length,
    uniqueHashCount: hashes.size,
    allHashesUnique: hashes.size === segments.length || maxY < 60,
    segments,
  };
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });

  await page.goto(`${BASE}/workspace`, { waitUntil: "domcontentloaded", timeout: 90000 });
  await page.waitForTimeout(2500);
  console.log("warm url:", page.url());

  const results = [];
  for (const cfg of PAGES) {
    results.push(await capturePage(page, cfg));
  }

  await browser.close();

  const index = {
    capturedAt: new Date().toISOString(),
    source: BASE,
    businessId: BUSINESS_ID,
    viewport: VIEWPORT,
    views: results,
  };
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
  console.log("\nWrote", path.join(OUT, "index.json"));

  const bad = results.filter((r) => r.maxY > 100 && !r.allHashesUnique);
  if (bad.length) {
    console.error("FAILED uniqueness:", bad.map((b) => b.view));
    process.exit(1);
  }
  console.log("OK");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
