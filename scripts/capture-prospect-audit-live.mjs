/**
 * Capture Prospect Audit from production (real Google Maps tiles).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/prospect-audit";
const BASE = "https://app.localseoexpress.com";
const PROSPECT_ID = "624060b5-9d90-41f0-9443-71de6ca3f433"; // Junk Goats

function md5(file) {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

async function shot(page, file, label) {
  const full = path.join(OUT, file);
  await page.screenshot({ path: full, fullPage: false });
  console.log("wrote", full, md5(full), label);
}

async function waitForMap(page) {
  for (let i = 0; i < 24; i++) {
    const state = await page.evaluate(() => {
      const missing = /Missing Google Maps API key/i.test(document.body?.innerText || "");
      const canvas = document.querySelector("canvas");
      const gmap = document.querySelector(".gm-style");
      return { missing, hasCanvas: !!canvas, hasGmap: !!gmap };
    });
    if (state.hasGmap || state.hasCanvas) return state;
    if (state.missing) return state;
    await page.waitForTimeout(500);
  }
  return { missing: true };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const url = `${BASE}/prospects/${PROSPECT_ID}/audit`;
  console.log("Opening", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(2500);

  // Dev bypass may already be on; if login wall, try /dev
  const body = await page.locator("body").innerText();
  if (/sign in|log in|password/i.test(body) && !/Prospect Audit/i.test(body)) {
    console.log("Auth wall — trying exit/enter via cookie path");
  }

  await page.waitForSelector("text=Prospect Audit", { timeout: 90000 });
  await page.waitForTimeout(1500);
  await shot(page, "live-audit-top.png", "top");

  const mapState = await waitForMap(page);
  console.log("map state", mapState);

  // Scroll to map / competitors
  await page.evaluate(() => {
    const el =
      [...document.querySelectorAll("h2")].find((h) =>
        /map|competitor|heatmap|local map/i.test(h.textContent || "")
      ) || null;
    el?.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(1200);
  await shot(page, "live-audit-map.png", "map section");

  const full = path.join(OUT, "live-audit-full.png");
  await page.screenshot({ path: full, fullPage: true });
  console.log("wrote", full, md5(full), "full");

  await browser.close();
  console.log("Done");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
