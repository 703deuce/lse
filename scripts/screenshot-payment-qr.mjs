/**
 * Capture Pay & Review Page template screenshots.
 * Usage: node scripts/screenshot-payment-qr.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000";
const outDir = process.env.ARTIFACT_DIR ?? "/opt/cursor/artifacts/screenshots";

const templateShots = [
  { name: "pay-review-template-floral-pink", theme: "floral_pink" },
  { name: "pay-review-template-modern-blue", theme: "modern_blue" },
  { name: "pay-review-template-bold-professional", theme: "bold_professional" },
  { name: "pay-review-template-minimal-elegant", theme: "minimal_elegant" },
  { name: "pay-review-template-dark-luxury", theme: "dark_luxury" },
];

const adminShots = [
  { name: "payment-qr-01-campaign-list", url: `${baseUrl}/dev/payment-qr-preview#campaign-list` },
  { name: "payment-qr-02-type-selector", url: `${baseUrl}/dev/payment-qr-preview#type-selector` },
  { name: "payment-qr-03-wizard-basic", url: `${baseUrl}/dev/payment-qr-preview#wizard-basic` },
  { name: "payment-qr-04-wizard-methods", url: `${baseUrl}/dev/payment-qr-preview#wizard-methods` },
  { name: "payment-qr-05-wizard-preview", url: `${baseUrl}/dev/payment-qr-preview#wizard-preview` },
  { name: "payment-qr-06-campaign-editor", url: `${baseUrl}/dev/payment-qr-preview#campaign-editor` },
  { name: "payment-qr-07-analytics", url: `${baseUrl}/dev/payment-qr-preview#analytics` },
  { name: "payment-qr-templates-all", url: `${baseUrl}/dev/payment-qr-templates`, fullPage: true },
  { name: "payment-qr-public-live", url: `${baseUrl}/dev/pay-preview` },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });

for (const shot of adminShots) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(shot.url, { waitUntil: "networkidle" });
  await page.waitForTimeout(shot.fullPage ? 1200 : 600);
  const file = path.join(outDir, `${shot.name}.png`);
  if (shot.fullPage) {
    await page.screenshot({ path: file, fullPage: true });
  } else {
    await page.screenshot({ path: file });
  }
  console.log(`saved ${file}`);
  await page.close();
}

for (const shot of templateShots) {
  const page = await browser.newPage({ viewport: { width: 420, height: 900 } });
  await page.goto(`${baseUrl}/dev/payment-qr-templates#template-${shot.theme}`, {
    waitUntil: "networkidle",
  });
  await page.waitForTimeout(800);
  await page.evaluate((theme) => {
    const root = document.querySelector(`#template-${theme}`);
    if (!root) return;
    const scroll = root.querySelector(".overflow-y-auto");
    if (scroll) {
      scroll.style.height = "auto";
      scroll.style.overflow = "visible";
    }
  }, shot.theme);
  await page.waitForTimeout(200);
  const el = page.locator(`#template-${shot.theme}`);
  const file = path.join(outDir, `${shot.name}.png`);
  await el.screenshot({ path: file });
  console.log(`saved ${file}`);
  await page.close();
}

await browser.close();
console.log("All screenshots saved to", outDir);
