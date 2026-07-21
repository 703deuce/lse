/**
 * Capture Rank Grid results page with true top-to-bottom scroll segments.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/rank-grid-results";
const URL = "http://localhost:3000/dev/grid-rank-preview";
const VIEWPORT = { width: 1440, height: 700 };
const OVERLAP = 80;

function md5(file) {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

async function getScrollMetrics(page) {
  return page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    const main = document.querySelector("main");
    const panel = document.querySelector(".flex-1.overflow-x-hidden.overflow-y-auto");
    const candidates = [panel, main, el, document.body].filter(Boolean);
    let best = el;
    let bestH = 0;
    for (const c of candidates) {
      const h = Math.max(c.scrollHeight || 0, c.clientHeight || 0);
      if (h > bestH) {
        bestH = h;
        best = c;
      }
    }
    const isWindow =
      best === el || best === document.documentElement || best === document.body;
    const scrollY = isWindow
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
      target: isWindow ? "window" : "panel",
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
    const panel = document.querySelector(".flex-1.overflow-x-hidden.overflow-y-auto");
    if (panel) panel.scrollTop = target;
  }, y);
  await page.waitForTimeout(500);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });

  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.getByRole("button", { name: "Rank Grid", exact: true }).click();
  await page.waitForTimeout(2500);
  // Wait for SERP rail listings (profile bubbles)
  await page.waitForSelector("text=View more results", { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(2000);

  await scrollToY(page, 0);
  await page.waitForTimeout(800);

  const metrics = await getScrollMetrics(page);
  const step = Math.max(320, metrics.clientHeight - OVERLAP);
  const maxY = Math.max(0, metrics.scrollHeight - metrics.clientHeight);
  const positions = [0];
  if (maxY > 200) {
    const mid = Math.round(maxY / 2);
    if (mid > 180) positions.push(mid);
  }
  if (maxY > 40 && positions[positions.length - 1] !== maxY) {
    positions.push(maxY);
  }

  // Drop near-duplicates (within 60px)
  const unique = [];
  for (const y of positions) {
    if (!unique.length || Math.abs(y - unique[unique.length - 1]) >= 60) unique.push(y);
  }

  const index = [];
  for (let i = 0; i < unique.length; i++) {
    const y = unique[i];
    await scrollToY(page, y);
    const name = `${String(i + 1).padStart(2, "0")}-of-${String(unique.length).padStart(2, "0")}-scrollY-${y}.png`;
    const file = path.join(OUT, name);
    await page.screenshot({ path: file, fullPage: false });
    const hash = md5(file);
    index.push({ file: name, scrollY: y, md5: hash });
    console.log(name, "md5=", hash);
  }

  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify({ url: URL, viewport: VIEWPORT, shots: index }, null, 2));
  await browser.close();
  console.log("Saved", index.length, "shots to", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
