/**
 * Capture real production app UI for GMR marketing page.
 * Uses app.localseoexpress.com with dev-mode business (no login wall in agent env).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const LIVE = process.env.LIVE_URL ?? "https://app.localseoexpress.com";
const BIZ = process.env.LIVE_BUSINESS_ID ?? "e64dbadd-69bb-4715-a526-6d137c0ae409";
const OUT_ARTIFACTS = "/opt/cursor/artifacts/screenshots/gmr-app";
const OUT_SITE = path.join(__dirname, "../Seoexpress/images");
const VIEWPORT = { width: 1440, height: 900 };
const PAY_PUBLIC = process.env.GMR_PAY_SLUG ?? "rauLSPVBien9";

function paths(file) {
  return {
    artifact: path.join(OUT_ARTIFACTS, file),
    site: path.join(OUT_SITE, file),
  };
}

async function saveLocator(locator, file) {
  await locator.waitFor({ state: "visible", timeout: 90000 });
  await locator.page().waitForTimeout(1500);
  const { artifact, site } = paths(file);
  await locator.screenshot({ path: artifact });
  fs.copyFileSync(artifact, site);
  console.log("saved", file);
}

async function shotMain(page, file) {
  await page.waitForTimeout(2000);
  const main = page.locator("main").first();
  await main.waitFor({ state: "visible", timeout: 60000 });
  const { artifact, site } = paths(file);
  await main.screenshot({ path: artifact });
  fs.copyFileSync(artifact, site);
  console.log("saved", file);
}

async function shotPage(page, file) {
  await page.waitForTimeout(2000);
  const { artifact, site } = paths(file);
  await page.screenshot({ path: artifact, fullPage: false });
  fs.copyFileSync(artifact, site);
  console.log("saved", file);
}

async function goto(page, pathSuffix) {
  const url = `${LIVE}/businesses/${BIZ}/${pathSuffix}`;
  console.log("→", url);
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3500);
}

async function waitForSendWizard(page) {
  await page.getByRole("button", { name: "One-Time Send", exact: true }).waitFor({ timeout: 60000 });
  await page.getByText("Who are you sending to?", { exact: false }).first().waitFor({ timeout: 60000 });
  await page.waitForTimeout(2000);
}

async function main() {
  fs.mkdirSync(OUT_ARTIFACTS, { recursive: true });
  fs.mkdirSync(OUT_SITE, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/local/bin/google-chrome",
  });
  const page = await browser.newPage({ viewport: VIEWPORT });

  // One-Time Send — SMS section + hero visual
  await goto(page, "reputation/requests?tab=send");
  await waitForSendWizard(page);
  await shotMain(page, "gmr-sms-send.png");

  const oneTimeSend = page
    .getByText("Requests Sent", { exact: false })
    .first()
    .locator("xpath=ancestor::div[contains(@class,'space-y-4')][1]");
  await saveLocator(oneTimeSend, "gmr-hero.png");

  const phonePreview = page.getByText("Review request · SMS").locator(
    "xpath=ancestor::div[contains(@class,'rounded-[2rem]')][1]"
  );
  await saveLocator(phonePreview, "gmr-feature-sms.png");

  // Campaign history — dashboard section
  await goto(page, "reputation/campaigns");
  await page.getByText("Campaign", { exact: false }).first().waitFor({ timeout: 60000 });
  await shotMain(page, "gmr-requests-dashboard.png");

  // Direct review link
  await goto(page, "reputation/requests?tab=link");
  await page.getByText("Link & Share", { exact: false }).first().waitFor({ timeout: 60000 });
  await shotMain(page, "gmr-review-link.png");
  const linkPanel = page
    .getByText("Shareable Review Link", { exact: false })
    .first()
    .locator("xpath=ancestor::div[contains(@class,'rounded-xl')][1]");
  await saveLocator(linkPanel, "gmr-feature-link.png");

  // QR from requests flow (poster preview in tab)
  await goto(page, "reputation/requests?tab=qr");
  await page.getByText("QR Code", { exact: false }).first().waitFor({ timeout: 60000 });
  await shotMain(page, "gmr-qr-poster-tab.png");
  const qrPreview = page
    .getByText("This is a preview", { exact: false })
    .first()
    .locator("xpath=ancestor::div[contains(@class,'rounded')][1]");
  await saveLocator(qrPreview, "gmr-feature-qr.png");

  // Full QR poster designer
  await goto(page, "reputation/qr");
  await page.waitForFunction(
    () => !/Loading QR campaign/i.test(document.body?.innerText || ""),
    { timeout: 90000 }
  );
  await page.waitForTimeout(2000);
  await shotMain(page, "gmr-qr-poster.png");

  // Email templates — full section + email tab crop for feature card
  await goto(page, "reputation/templates");
  await page.getByText("Templates", { exact: false }).first().waitFor({ timeout: 60000 });
  await page.getByRole("button", { name: "Email", exact: true }).click();
  await page.waitForTimeout(2000);
  await shotMain(page, "gmr-email-templates.png");
  const emailPreview = page.locator("iframe, [data-email-preview], .email-preview").first();
  try {
    await saveLocator(emailPreview, "gmr-feature-email.png");
  } catch {
    const editorCard = page.locator("main").locator("div").filter({ hasText: "How did we do" }).first();
    try {
      await saveLocator(editorCard, "gmr-feature-email.png");
    } catch {
      await shotMain(page, "gmr-feature-email.png");
    }
  }

  // Google reviews feed
  await goto(page, "reputation/reviews");
  await shotMain(page, "gmr-reviews-feed.png");

  // Reputation overview (problem section)
  await goto(page, "reputation/overview");
  await shotMain(page, "gmr-reputation-overview.png");

  // Request analytics
  await goto(page, "reputation/analytics");
  await shotMain(page, "gmr-request-analytics.png");

  // Pay & Review public hosted page (desktop)
  const payDesktop = await browser.newPage({ viewport: { width: 900, height: 1000 } });
  await payDesktop.goto(`${LIVE}/p/${PAY_PUBLIC}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await shotPage(payDesktop, "gmr-pay-review.png");
  await payDesktop.close();

  // Pay & Review mobile — feature card + optional mobile asset
  const payMobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
  await payMobile.goto(`${LIVE}/p/${PAY_PUBLIC}`, { waitUntil: "domcontentloaded", timeout: 120000 });
  await shotPage(payMobile, "gmr-pay-review-mobile.png");
  const payBody = payMobile.locator("body");
  await saveLocator(payBody, "gmr-feature-pay.png");
  await payMobile.close();

  await browser.close();
  console.log("Done →", OUT_SITE);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
