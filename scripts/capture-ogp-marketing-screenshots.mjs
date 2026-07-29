/**
 * Capture production app UI for Optimize Google Business Profile marketing page.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIVE = process.env.LIVE_URL ?? "https://app.localseoexpress.com";
const BIZ = process.env.LIVE_BUSINESS_ID ?? "e64dbadd-69bb-4715-a526-6d137c0ae409";
const OUT_ARTIFACTS = "/opt/cursor/artifacts/screenshots/ogp-app";
const OUT_SITE = path.join(__dirname, "../Seoexpress/images");
const VIEWPORT = { width: 1440, height: 900 };

function paths(file) {
  return { artifact: path.join(OUT_ARTIFACTS, file), site: path.join(OUT_SITE, file) };
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

  // Hero + audit dashboard — Growth Audit overview
  await goto(page, "growth-audit?tab=overview");
  await shotMain(page, "ogp-hero.png");
  await shotMain(page, "ogp-audit-dashboard.png");

  const scoreCard = page.getByText("Growth Audit", { exact: false }).first().locator(
    "xpath=ancestor::main[1]"
  );
  try {
    const gauge = page.getByText("Profile Score", { exact: false }).first().locator(
      "xpath=ancestor::div[contains(@class,'rounded')][1]"
    );
    await saveLocator(gauge, "ogp-feature-profile.png");
  } catch {
    fs.copyFileSync(path.join(OUT_SITE, "ogp-hero.png"), path.join(OUT_SITE, "ogp-feature-profile.png"));
  }

  // Problem context — overview opportunities
  await shotMain(page, "ogp-problem.png");

  // GBP — business information + photos
  await goto(page, "growth-audit?tab=gbp");
  await shotMain(page, "ogp-business-info.png");
  try {
    await saveLocator(
      page.getByText("GBP Profile Score", { exact: false }).first().locator(
        "xpath=ancestor::div[contains(@class,'rounded')][1]"
      ),
      "ogp-feature-profile.png"
    );
  } catch { /* keep */ }
  const photosBlock = page.getByText("Photos", { exact: false }).first().locator(
    "xpath=ancestor::div[contains(@class,'rounded')][1]"
  );
  try {
    await saveLocator(photosBlock, "ogp-photos.png");
    fs.copyFileSync(path.join(OUT_SITE, "ogp-photos.png"), path.join(OUT_SITE, "ogp-feature-photos.png"));
  } catch {
    await shotMain(page, "ogp-photos.png");
  }

  // Reviews
  await goto(page, "reputation/reviews");
  await shotMain(page, "ogp-reviews-section.png");
  try {
    await saveLocator(page.locator("table").first(), "ogp-feature-reviews.png");
  } catch {
    await goto(page, "reputation/requests?tab=send");
    await shotMain(page, "ogp-feature-reviews.png");
  }
  await goto(page, "reputation/requests?tab=send");
  await shotMain(page, "ogp-reviews.png");

  // Rankings
  await goto(page, "scans");
  await shotMain(page, "ogp-rankings.png");
  const gridHero = path.join(OUT_SITE, "grid-hero.png");
  if (fs.existsSync(gridHero)) {
    fs.copyFileSync(gridHero, path.join(OUT_SITE, "ogp-feature-rankings.png"));
    console.log("saved ogp-feature-rankings.png (grid-hero)");
  }

  // Competitors
  await goto(page, "growth-audit?tab=competitor-gap");
  await shotMain(page, "ogp-competitors.png");
  try {
    await saveLocator(page.locator("table").first(), "ogp-feature-competitors.png");
  } catch {
    await goto(page, "reputation/competitors");
    await shotMain(page, "ogp-feature-competitors.png");
  }

  // Authority
  await goto(page, "trust");
  await shotMain(page, "ogp-authority.png");
  try {
    await saveLocator(page.locator("table").first(), "ogp-feature-authority.png");
  } catch {
    fs.copyFileSync(path.join(OUT_SITE, "ogp-authority.png"), path.join(OUT_SITE, "ogp-feature-authority.png"));
  }

  // AI visibility
  await goto(page, "ai-visibility");
  await shotMain(page, "ogp-ai-visibility.png");
  const aiPanel = page.locator("main").locator("div").filter({ hasText: "Mention" }).first();
  try {
    await saveLocator(aiPanel, "ogp-feature-ai.png");
  } catch {
    fs.copyFileSync(path.join(OUT_SITE, "ogp-ai-visibility.png"), path.join(OUT_SITE, "ogp-feature-ai.png"));
  }

  // Benefits — action plan
  await goto(page, "growth-audit?tab=growth-plan");
  await shotMain(page, "ogp-benefits.png");

  // Dashboard hub
  await goto(page, "overview");
  await shotMain(page, "ogp-dashboard.png");

  await browser.close();
  console.log("Done →", OUT_SITE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
