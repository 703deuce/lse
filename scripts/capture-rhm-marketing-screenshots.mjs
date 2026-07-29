/**
 * Capture production app UI for Rank Higher in Google Maps marketing page.
 * Each asset maps to the section or tool card it represents.
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

function copyToSite(file) {
  const { artifact, site } = paths(file);
  if (fs.existsSync(artifact)) fs.copyFileSync(artifact, site);
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

  // Completed ranking heat map (grid results) — hero only
  const gridHero = path.join(OUT_SITE, "grid-hero.png");
  if (fs.existsSync(gridHero)) {
    fs.copyFileSync(gridHero, path.join(OUT_SITE, "rhm-hero.png"));
    fs.copyFileSync(gridHero, path.join(OUT_ARTIFACTS, "rhm-hero.png"));
    console.log("saved rhm-hero.png (from grid-hero.png heat map results)");
  }

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/local/bin/google-chrome",
  });
  const page = await browser.newPage({ viewport: VIEWPORT });

  // Rankings — scan setup (section) + heat map card fallback
  await goto(page, "scans");
  await shotMain(page, "rhm-rankings.png");
  const mapWrap = page.locator("main").locator("div").filter({ has: page.locator("img[alt*='map'], [class*='map']") }).first();
  try {
    await saveLocator(mapWrap, "rhm-feature-rankings.png");
  } catch {
    const gridHero = path.join(OUT_SITE, "grid-hero.png");
    if (fs.existsSync(gridHero)) {
      fs.copyFileSync(gridHero, path.join(OUT_SITE, "rhm-feature-rankings.png"));
      console.log("saved rhm-feature-rankings.png (from grid-hero.png)");
    }
  }

  // Problem — growth audit overview
  await goto(page, "growth-audit?tab=overview");
  await shotMain(page, "rhm-problem.png");

  // GBP full section + tool card crop
  await goto(page, "growth-audit?tab=gbp");
  await shotMain(page, "rhm-gbp.png");
  const gbpScore = page.getByText("GBP Profile Score", { exact: false }).first().locator(
    "xpath=ancestor::div[contains(@class,'rounded')][1]"
  );
  try {
    await saveLocator(gbpScore, "rhm-feature-gbp.png");
  } catch {
    copyToSite("rhm-gbp.png");
    fs.copyFileSync(path.join(OUT_SITE, "rhm-gbp.png"), path.join(OUT_SITE, "rhm-feature-gbp.png"));
  }

  // Competitors — reputation competitor intelligence
  await goto(page, "reputation/competitors");
  await page.waitForTimeout(2000);
  try {
    await shotMain(page, "rhm-competitors.png");
  } catch {
    await goto(page, "growth-audit?tab=competitor-gap");
    await shotMain(page, "rhm-competitors.png");
  }
  const compTable = page.locator("table").first();
  try {
    await saveLocator(compTable, "rhm-feature-competitors.png");
  } catch {
    copyToSite("rhm-competitors.png");
    fs.copyFileSync(path.join(OUT_SITE, "rhm-competitors.png"), path.join(OUT_SITE, "rhm-feature-competitors.png"));
    console.log("saved rhm-feature-competitors.png (copy)");
  }

  // Benefits / action plan — SEO recommendations
  await goto(page, "growth-audit?tab=growth-plan");
  await shotMain(page, "rhm-benefits.png");
  fs.copyFileSync(path.join(OUT_SITE, "rhm-benefits.png"), path.join(OUT_SITE, "rhm-opportunities.png"));
  console.log("saved rhm-opportunities.png (alias of benefits)");

  // Reviews section + tool card
  await goto(page, "reputation/requests?tab=send");
  await shotMain(page, "rhm-reviews.png");
  const phone = page.getByText("Review request · SMS").locator(
    "xpath=ancestor::div[contains(@class,'rounded-[2rem]')][1]"
  );
  try {
    await saveLocator(phone, "rhm-feature-reviews.png");
  } catch {
    copyToSite("rhm-reviews.png");
    fs.copyFileSync(path.join(OUT_SITE, "rhm-reviews.png"), path.join(OUT_SITE, "rhm-feature-reviews.png"));
    console.log("saved rhm-feature-reviews.png (copy)");
  }

  // Local authority — sponsorship opportunities
  await goto(page, "trust");
  await shotMain(page, "rhm-authority.png");
  const oppRow = page.getByText("Opportunity", { exact: false }).first().locator(
    "xpath=ancestor::tr[1] | ancestor::div[contains(@class,'rounded')][1]"
  );
  try {
    await saveLocator(oppRow, "rhm-feature-authority.png");
  } catch {
    const trustList = page.locator("main").locator("table").first();
    try {
      await saveLocator(trustList, "rhm-feature-authority.png");
    } catch {
      copyToSite("rhm-authority.png");
      fs.copyFileSync(path.join(OUT_SITE, "rhm-authority.png"), path.join(OUT_SITE, "rhm-feature-authority.png"));
    }
  }

  // Backlinks (used for authority/backlink messaging)
  await goto(page, "backlink-gap");
  await shotMain(page, "rhm-backlinks.png");

  // AI visibility section + tool card
  await goto(page, "ai-visibility");
  await shotMain(page, "rhm-ai-visibility.png");
  const aiPanel = page.locator("main").locator("div").filter({ hasText: "Mention" }).first();
  try {
    await saveLocator(aiPanel, "rhm-feature-ai.png");
  } catch {
    copyToSite("rhm-ai-visibility.png");
    fs.copyFileSync(path.join(OUT_SITE, "rhm-ai-visibility.png"), path.join(OUT_SITE, "rhm-feature-ai.png"));
  }

  // Dashboard — business overview hub
  await goto(page, "overview");
  await shotMain(page, "rhm-dashboard.png");

  await browser.close();
  console.log("Done →", OUT_SITE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
