/**
 * Capture Backlink Gap tabs with true top-to-bottom scroll segments.
 * Each segment is a distinct viewport; we verify scrollY advances and
 * file hashes differ so we never ship duplicate "top" shots.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/backlink-gap";
const URL = "http://localhost:3000/dev/backlink-gap-preview";
const VIEWPORT = { width: 1440, height: 600 };
const OVERLAP = 80; // px overlap between segments for continuity

const TABS = [
  { label: "Overview", slug: "01-overview" },
  { label: "Opportunities", slug: "02-opportunities" },
  { label: "Competitor Matrix", slug: "03-competitor-matrix" },
  { label: "Ignored / Spam", slug: "04-ignored-spam" },
  { label: "Tasks", slug: "05-tasks" },
];

function md5(file) {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

async function getScrollMetrics(page) {
  return page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return {
      scrollY: window.scrollY || el.scrollTop || 0,
      clientHeight: window.innerHeight,
      scrollHeight: Math.max(
        el.scrollHeight,
        document.body?.scrollHeight || 0,
        document.documentElement.scrollHeight
      ),
    };
  });
}

async function scrollToY(page, y) {
  await page.evaluate((target) => {
    window.scrollTo({ top: target, left: 0, behavior: "instant" });
    document.documentElement.scrollTop = target;
    document.body.scrollTop = target;
  }, y);
  await page.waitForTimeout(400);
}

async function captureTab(page, tab) {
  const tabDir = path.join(OUT, tab.slug);
  fs.mkdirSync(tabDir, { recursive: true });

  await page.getByRole("button", { name: tab.label, exact: true }).click();
  await page.waitForTimeout(2000);

  // Expand collapsed accordions so tall tabs capture full content
  const expanders = page.locator('button:has(svg.lucide-chevron-right), button:has([class*="ChevronRight"])');
  const count = await expanders.count().catch(() => 0);
  for (let i = 0; i < Math.min(count, 8); i++) {
    await expanders.nth(i).click().catch(() => {});
    await page.waitForTimeout(200);
  }

  await scrollToY(page, 0);
  await page.waitForTimeout(500);

  const metrics = await getScrollMetrics(page);
  const step = Math.max(200, metrics.clientHeight - OVERLAP);
  const maxY = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  const positions = [];
  for (let y = 0; y <= maxY; y += step) positions.push(Math.min(y, maxY));
  if (positions[positions.length - 1] !== maxY) positions.push(maxY);
  // Deduplicate consecutive positions
  const unique = [...new Set(positions.map((n) => Math.round(n)))];

  const segments = [];
  for (let i = 0; i < unique.length; i++) {
    const y = unique[i];
    await scrollToY(page, y);
    const after = await getScrollMetrics(page);
    const file = path.join(tabDir, `${String(i + 1).padStart(2, "0")}-y${Math.round(after.scrollY)}.png`);
    await page.screenshot({ path: file, fullPage: false });
    const hash = md5(file);
    segments.push({
      index: i + 1,
      requestedY: y,
      actualScrollY: Math.round(after.scrollY),
      file,
      md5: hash,
      scrollHeight: after.scrollHeight,
      clientHeight: after.clientHeight,
    });
  }

  // Also save one true full-page capture for reference
  await scrollToY(page, 0);
  const fullFile = path.join(tabDir, "full-page.png");
  await page.screenshot({ path: fullFile, fullPage: true });

  // Validate uniqueness of viewport segments
  const hashes = segments.map((s) => s.md5);
  const uniqueHashes = new Set(hashes);
  const scrollYs = segments.map((s) => s.actualScrollY);
  const advanced =
    scrollYs.length === 1 || scrollYs.every((v, i) => i === 0 || v > scrollYs[i - 1] || maxY === 0);

  return {
    tab: tab.label,
    slug: tab.slug,
    scrollHeight: metrics.scrollHeight,
    clientHeight: metrics.clientHeight,
    maxY,
    segmentCount: segments.length,
    uniqueHashCount: uniqueHashes.size,
    scrollAdvanced: advanced,
    allHashesUnique: uniqueHashes.size === hashes.length || maxY === 0,
    segments,
    fullPage: fullFile,
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });

  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForTimeout(3500);

  const h1 = await page.locator("h1").first().textContent().catch(() => null);
  console.log("page h1:", h1);

  const results = [];
  for (const tab of TABS) {
    console.log("\n=== Capturing", tab.label, "===");
    const result = await captureTab(page, tab);
    results.push(result);
    console.log(
      JSON.stringify(
        {
          tab: result.tab,
          scrollHeight: result.scrollHeight,
          segmentCount: result.segmentCount,
          uniqueHashes: result.uniqueHashCount,
          scrollYs: result.segments.map((s) => s.actualScrollY),
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
    note: "Viewport segments scroll top→bottom. Each 01/02/03… shot is a distinct scrollY. full-page.png is the entire tab in one image.",
    tabs: results.map((r) => ({
      tab: r.tab,
      slug: r.slug,
      scrollHeight: r.scrollHeight,
      clientHeight: r.clientHeight,
      segmentCount: r.segmentCount,
      allHashesUnique: r.allHashesUnique,
      scrollAdvanced: r.scrollAdvanced,
      segments: r.segments.map((s) => ({
        index: s.index,
        scrollY: s.actualScrollY,
        file: s.file,
        md5: s.md5,
      })),
      fullPage: r.fullPage,
    })),
  };

  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
  console.log("\nWrote", path.join(OUT, "index.json"));

  const bad = results.filter((r) => r.maxY > 100 && !r.allHashesUnique);
  if (bad.length) {
    console.error("FAILED uniqueness for:", bad.map((b) => b.tab));
    process.exit(1);
  }
  console.log("OK: all long tabs have unique viewport hashes");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
