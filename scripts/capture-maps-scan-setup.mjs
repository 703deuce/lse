/**
 * Local screenshots of Maps Scans setup (map tiles may be missing).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/maps-scan-setup";
const URL = "http://localhost:3000/dev/grid-rank-preview";
const VIEWPORT = { width: 1440, height: 600 };
const OVERLAP = 80;

function md5(file) {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
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
  await page.waitForTimeout(450);
}

async function metrics(page) {
  return page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return {
      scrollY: window.scrollY || el.scrollTop || 0,
      clientHeight: window.innerHeight,
      scrollHeight: Math.max(el.scrollHeight, document.body?.scrollHeight || 0),
    };
  });
}

async function main() {
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });
  await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3000);

  await page.getByRole("button", { name: "Scans hub", exact: true }).click();
  await page.waitForTimeout(2500);

  // Expand general if needed (should already be open)
  const general = page.getByRole("button", { name: "General settings" });
  if (await general.count()) {
    const expanded = await general.getAttribute("aria-expanded");
    if (expanded !== "true") {
      await general.click();
      await page.waitForTimeout(400);
    }
  }

  await scrollToY(page, 0);
  await page.waitForTimeout(600);

  const m = await metrics(page);
  const step = Math.max(200, m.clientHeight - OVERLAP);
  const maxY = Math.max(0, m.scrollHeight - m.clientHeight);
  const positions = [];
  for (let y = 0; y <= maxY; y += step) positions.push(Math.min(y, maxY));
  if (positions.at(-1) !== maxY) positions.push(maxY);
  const unique = [...new Set(positions.map((n) => Math.round(n)))];

  const segments = [];
  for (let i = 0; i < unique.length; i++) {
    await scrollToY(page, unique[i]);
    const after = await metrics(page);
    const file = path.join(
      OUT,
      `${String(i + 1).padStart(2, "0")}-of-${String(unique.length).padStart(2, "0")}-scrollY-${Math.round(after.scrollY)}.png`
    );
    await page.screenshot({ path: file, fullPage: false });
    segments.push({ index: i + 1, scrollY: Math.round(after.scrollY), file, md5: md5(file) });
  }

  await scrollToY(page, 0);
  await page.screenshot({ path: path.join(OUT, "full-page.png"), fullPage: true });

  const index = {
    capturedAt: new Date().toISOString(),
    url: URL,
    note: "Local setup page screenshots. Map tiles may be missing without API key — UI chrome is the verification target.",
    viewport: VIEWPORT,
    segments,
    uniqueHashes: new Set(segments.map((s) => s.md5)).size,
  };
  fs.writeFileSync(path.join(OUT, "index.json"), JSON.stringify(index, null, 2));
  console.log(JSON.stringify(index, null, 2));

  await browser.close();
  if (segments.length > 1 && index.uniqueHashes !== segments.length) {
    console.error("duplicate segments");
    process.exit(1);
  }
  console.log("OK");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
