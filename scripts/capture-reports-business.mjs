/**
 * Capture business Reports hub (mockup restyle) with top-to-bottom scroll segments.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/reports-business";
const URL = "http://localhost:3000/dev/reports-preview";
const VIEWPORT = { width: 1440, height: 700 };
const OVERLAP = 80;

function md5(file) {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

async function getScrollMetrics(page) {
  return page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    const mains = [...document.querySelectorAll("main, .overflow-y-auto")];
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

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });

  await page.goto(URL, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Select a report template", { timeout: 60000 });
  await page.waitForTimeout(2000);

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

  const unique = [];
  for (const y of positions) {
    if (!unique.length || Math.abs(y - unique[unique.length - 1]) >= 60) unique.push(y);
  }

  const shots = [];
  for (let i = 0; i < unique.length; i++) {
    const y = unique[i];
    await scrollToY(page, y);
    const after = await getScrollMetrics(page);
    const name = `${String(i + 1).padStart(2, "0")}-of-${String(unique.length).padStart(2, "0")}-scrollY-${Math.round(after.scrollY)}.png`;
    const file = path.join(OUT, name);
    await page.screenshot({ path: file, fullPage: false });
    const hash = md5(file);
    shots.push({ file: name, scrollY: Math.round(after.scrollY), md5: hash });
    console.log(name, "md5=", hash);
  }

  fs.writeFileSync(
    path.join(OUT, "index.json"),
    JSON.stringify({ url: URL, viewport: VIEWPORT, shots }, null, 2)
  );
  await browser.close();
  console.log("Saved", shots.length, "shots to", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
