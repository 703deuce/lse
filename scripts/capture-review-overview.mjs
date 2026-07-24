import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/review-overview";
const BASE = process.env.CAPTURE_BASE_URL || "http://127.0.0.1:3000";

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  const url = `${BASE}/dev/review-overview-preview`;
  console.log("Opening", url);
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Review Overview", { timeout: 60000 });
  await page.waitForTimeout(1500);

  await page.screenshot({
    path: path.join(OUT, "01-overview-viewport.png"),
    fullPage: false,
  });
  console.log("wrote viewport");

  await page.screenshot({
    path: path.join(OUT, "01-overview-full.png"),
    fullPage: true,
  });
  console.log("wrote full");

  // Mobile
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(600);
  await page.screenshot({
    path: path.join(OUT, "02-overview-mobile.png"),
    fullPage: true,
  });
  console.log("wrote mobile");

  await browser.close();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
