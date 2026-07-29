/**
 * Capture Pay & Review QR wizard + public page from production.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = process.env.LIVE_URL ?? "https://app.localseoexpress.com";
const BUSINESS_ID = process.env.LIVE_BUSINESS_ID ?? "e64dbadd-69bb-4715-a526-6d137c0ae409";
const OUT = "/opt/cursor/artifacts/screenshots/payment-qr-live";
const WIZARD_URL = `${BASE}/businesses/${BUSINESS_ID}/reputation/qr-campaigns/new/payment`;

async function clickNext(page) {
  const next = page.getByRole("button", { name: /^Next/i });
  await next.waitFor({ state: "visible", timeout: 10000 });
  await next.click();
  await page.waitForTimeout(1200);
}

async function enableProvider(page, label, value) {
  const section = page
    .locator("div.rounded-2xl.border.p-4")
    .filter({ has: page.getByText(label, { exact: true }) });
  const toggle = section.locator("label.cursor-pointer").first();
  await toggle.click();
  await page.waitForTimeout(300);
  const input = section.locator("input:not([type='checkbox'])");
  await input.fill(value);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(WIZARD_URL, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("text=Business details", { timeout: 60000 });
  await page.waitForTimeout(2000);

  // Step 1 — pick Modern Blue template
  await page.getByRole("button", { name: "Clean & Modern" }).click();
  await page.locator("textarea").fill("Service beyond the tap");
  await page.screenshot({ path: path.join(OUT, "02-wizard-step1-modern-blue.png"), fullPage: true });
  await clickNext(page);

  // Step 2 — payment methods
  await enableProvider(page, "Pay with Venmo", "PureFlowPlumbing");
  await enableProvider(page, "Pay with PayPal", "pureflow");
  await enableProvider(page, "Pay with Cash App", "$pureflow");
  await enableProvider(page, "Pay with Zelle", "pay@pureflow.com");
  await page.screenshot({ path: path.join(OUT, "03-wizard-step2-methods-filled.png"), fullPage: true });
  await clickNext(page);

  // Step 3 — suggested amounts
  const suggestedBtn = page.getByRole("button", { name: /Suggested amounts/i });
  if (await suggestedBtn.isVisible({ timeout: 2000 })) {
    await suggestedBtn.click();
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: path.join(OUT, "04-wizard-step3-amounts.png"), fullPage: true });
  await clickNext(page);

  // Step 4 — reviews & links (google url should be pre-filled)
  await page.waitForTimeout(1000);
  await page.screenshot({ path: path.join(OUT, "05-wizard-step4-reviews.png"), fullPage: true });
  await clickNext(page);

  // Step 5 — preview
  await page.waitForSelector("text=Mobile preview", { timeout: 15000 });
  await page.waitForTimeout(2500);
  await page.screenshot({ path: path.join(OUT, "06-wizard-step5-full.png"), fullPage: true });

  const phoneFrame = page.locator(".overflow-hidden.rounded-\\[2rem\\]").first();
  if (await phoneFrame.isVisible()) {
    await phoneFrame.screenshot({ path: path.join(OUT, "07-live-mobile-preview-modern_blue.png") });
  }

  // Try publish
  const publish = page.getByRole("button", { name: /Publish Pay/i });
  await publish.click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: path.join(OUT, "08-after-publish.png"), fullPage: true });

  const bodyText = await page.locator("body").innerText();
  const errorMatch = bodyText.match(/Failed to create|Could not|error/i);
  console.log("after publish:", errorMatch ? bodyText.slice(0, 500) : "no obvious error");

  // If redirected to editor or public page, capture URL
  const finalUrl = page.url();
  console.log("final url:", finalUrl);

  if (finalUrl.includes("/p/")) {
    const pubPage = await browser.newPage({ viewport: { width: 420, height: 900 } });
    await pubPage.goto(finalUrl, { waitUntil: "domcontentloaded" });
    await pubPage.waitForTimeout(3000);
    await pubPage.screenshot({
      path: path.join(OUT, "09-live-public-page.png"),
      fullPage: true,
    });
    await pubPage.close();
  }

  // Extract slug from editor URL if publish worked
  const editorMatch = finalUrl.match(/qr-campaigns\/([a-f0-9-]+)/);
  if (editorMatch) {
    const detailRes = await page.request.get(
      `${BASE}/api/reputation/payment-qr?businessId=${BUSINESS_ID}&campaignId=${editorMatch[1]}`
    );
    if (detailRes.ok()) {
      const detail = await detailRes.json();
      const slug = detail.campaign?.publicSlug ?? detail.campaign?.shortCode;
      if (slug) {
        const pubUrl = `${BASE}/p/${slug}`;
        console.log("public page:", pubUrl);
        const pubPage = await browser.newPage({ viewport: { width: 420, height: 900 } });
        await pubPage.goto(pubUrl, { waitUntil: "domcontentloaded" });
        await pubPage.waitForTimeout(3000);
        await pubPage.screenshot({
          path: path.join(OUT, `10-public-${slug}.png`),
          fullPage: true,
        });
        await pubPage.close();
      }
    }
  }

  await browser.close();
  console.log("Done — screenshots in", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
