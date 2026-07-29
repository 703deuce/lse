/**
 * Capture production app UI for Rank Higher in Google Maps marketing page.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIVE = process.env.LIVE_URL ?? "https://app.localseoexpress.com";
const BIZ = process.env.LIVE_BUSINESS_ID ?? "e64dbadd-69bb-4715-a526-6d137c0ae409";
const OUT_ARTIFACTS = "/opt/cursor/artifacts/screenshots/rhm-app";
const OUT_SITE = path.join(__dirname, "../Seoexpress/images");
const VIEWPORT = { width: 1440, height: 900 };

function paths(file) {
  return {
    artifact: path.join(OUT_ARTIFACTS, file),
    site: path.join(OUT_SITE, file),
  };
}

async function shotMain(page, file) {
  await page.waitForTimeout(2000);
  const main = page.locator("main").first();
  await main.waitFor({ state: "visible", timeout: 90000 });
  const { artifact, site } = paths(file);
  await main.screenshot({ path: artifact });
  fs.copyFileSync(artifact, site);
  console.log("saved", file);
}

async function saveLocator(locator, file) {
  await locator.waitFor({ state: "visible", timeout: 90000 });
  await locator.page().waitForTimeout(1500);
  const { artifact, site } = paths(file);
  await locator.screenshot({ path: artifact });
  fs.copyFileSync(artifact, site);
  console.log("saved", file);
}

async function goto(page, pathSuffix) {
  const url = `${LIVE}/businesses/${BIZ}/${pathSuffix}`;
  console.log("→", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(4000);
}

async function main() {
  fs.mkdirSync(OUT_ARTIFACTS, { recursive: true });
  fs.mkdirSync(OUT_SITE, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/local/bin/google-chrome",
  });
  const page = await browser.newPage({ viewport: VIEWPORT });

  await goto(page, "scans");
  await shotMain(page, "rhm-rankings.png");
  fs.copyFileSync(path.join(OUT_SITE, "rhm-rankings.png"), path.join(OUT_SITE, "rhm-hero.png"));
  fs.copyFileSync(path.join(OUT_ARTIFACTS, "rhm-rankings.png"), path.join(OUT_ARTIFACTS, "rhm-hero.png"));
  console.log("saved rhm-hero.png (from scans main)");

  await goto(page, "growth-audit?tab=overview");
  await shotMain(page, "rhm-problem.png");

  await goto(page, "growth-audit?tab=gbp");
  await shotMain(page, "rhm-gbp.png");

  await goto(page, "growth-audit?tab=competitor-gap");
  await shotMain(page, "rhm-competitors.png");

  await goto(page, "growth-audit?tab=growth-plan");
  await shotMain(page, "rhm-opportunities.png");

  await goto(page, "reputation/requests?tab=send");
  await shotMain(page, "rhm-reviews.png");

  await goto(page, "trust");
  await shotMain(page, "rhm-authority.png");

  await goto(page, "backlink-gap");
  await shotMain(page, "rhm-backlinks.png");

  await goto(page, "ai-visibility");
  await shotMain(page, "rhm-ai-visibility.png");

  await goto(page, "overview");
  await shotMain(page, "rhm-dashboard.png");

  await browser.close();
  console.log("Done →", OUT_SITE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
