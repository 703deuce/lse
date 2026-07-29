/**
 * Capture Pay & Review "after scan" pages — live (current deploy) vs master (brand themes).
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const LIVE = process.env.LIVE_URL ?? "https://app.localseoexpress.com";
const LOCAL = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000";
const BUSINESS_ID = process.env.LIVE_BUSINESS_ID ?? "e64dbadd-69bb-4715-a526-6d137c0ae409";
const OUT = "/opt/cursor/artifacts/screenshots/pay-review-scan-compare";

const LIVE_SLUGS = [
  { slug: "rauLSPVBien9", label: "junk-removal-woodbridge" },
];

const MASTER_THEMES = [
  { theme: "clear_blue", label: "clear-blue-modern" },
  { theme: "elegant_black", label: "elegant-black" },
  { theme: "premium_gold", label: "premium-gold" },
];

async function captureHostedPage(page, url, outBase, label) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForTimeout(3500);

  const amountBtn = page.getByRole("button", { name: /^\$25$/ }).first();
  if (await amountBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await amountBtn.click();
    await page.waitForTimeout(500);
  }

  await page.screenshot({
    path: path.join(outBase, `${label}-full-page.png`),
    fullPage: true,
  });
  console.log("saved full", label);

  const googleBtn = page.getByRole("button", { name: /Leave a Google Review/i }).first();
  if (await googleBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
    await googleBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const box = await googleBtn.evaluate((el) => {
      const card = el.closest("div.rounded-2xl, div.rounded-xl, section");
      const target = card ?? el.parentElement;
      const r = target?.getBoundingClientRect();
      return r
        ? { x: Math.max(0, r.x - 8), y: Math.max(0, r.y - 8), width: r.width + 16, height: r.height + 16 }
        : null;
    });
    if (box && box.width > 0) {
      await page.screenshot({
        path: path.join(outBase, `${label}-google-review-section.png`),
        clip: box,
      });
    }
  }

  const poster = page.locator(".max-w-\\[360px\\]").first();
  if (await poster.isVisible({ timeout: 2000 }).catch(() => false)) {
    await poster.screenshot({ path: path.join(outBase, `${label}-poster-frame.png`) });
  }
}

async function captureLiveWizardPreview(browser, outDir) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const wizardUrl = `${LIVE}/businesses/${BUSINESS_ID}/reputation/qr-campaigns/new/payment`;
  await page.goto(wizardUrl, { waitUntil: "domcontentloaded", timeout: 120000 });
  await page.waitForSelector("text=Business details", { timeout: 60000 });
  await page.waitForTimeout(2000);

  const clickNext = async () => {
    await page.getByRole("button", { name: /^Next/i }).click();
    await page.waitForTimeout(1200);
  };

  const modern = page.getByRole("button", { name: /Clean & Modern/i });
  if (await modern.isVisible({ timeout: 3000 }).catch(() => false)) {
    await modern.click();
  }
  await page.locator("textarea").first().fill("Service beyond the tap");
  await clickNext();
  await clickNext();
  await clickNext();
  await clickNext();

  await page.waitForTimeout(3000);
  await page.screenshot({ path: path.join(outDir, "wizard-step5-full.png"), fullPage: true });

  const phone = page.locator(".overflow-hidden.rounded-\\[2rem\\]").first();
  if (await phone.isVisible()) {
    await phone.screenshot({ path: path.join(outDir, "wizard-step5-phone-preview.png") });
  }
  await page.close();
}

async function main() {
  const liveDir = path.join(OUT, "01-live-current-deploy");
  const masterDir = path.join(OUT, "02-master-brand-themes");
  fs.mkdirSync(liveDir, { recursive: true });
  fs.mkdirSync(masterDir, { recursive: true });

  const browser = await chromium.launch({ headless: true });

  for (const { slug, label } of LIVE_SLUGS) {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await captureHostedPage(mobile, `${LIVE}/p/${slug}`, liveDir, `after-scan-${label}`);
    await mobile.close();
  }

  await captureLiveWizardPreview(browser, liveDir);

  for (const { theme, label } of MASTER_THEMES) {
    const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await captureHostedPage(
      mobile,
      `${LOCAL}/dev/brand-theme-pay-preview?theme=${theme}`,
      masterDir,
      `after-scan-${label}`
    );
    await mobile.close();
  }

  await browser.close();
  console.log("Done:", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
