/**
 * Capture Payment QR UI screenshots from dev preview pages.
 * Usage: node scripts/screenshot-payment-qr.mjs
 */
import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const baseUrl = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000";
const outDir = process.env.ARTIFACT_DIR ?? "/opt/cursor/artifacts/screenshots";

const shots = [
  { name: "payment-qr-01-campaign-list", url: `${baseUrl}/dev/payment-qr-preview#campaign-list`, wait: 500 },
  { name: "payment-qr-02-type-selector", url: `${baseUrl}/dev/payment-qr-preview#type-selector`, wait: 500 },
  { name: "payment-qr-03-wizard-basic", url: `${baseUrl}/dev/payment-qr-preview#wizard-basic`, wait: 500 },
  { name: "payment-qr-04-wizard-methods", url: `${baseUrl}/dev/payment-qr-preview#wizard-methods`, wait: 500 },
  { name: "payment-qr-05-wizard-customize", url: `${baseUrl}/dev/payment-qr-preview#wizard-customize`, wait: 500 },
  { name: "payment-qr-06-public-pay", url: `${baseUrl}/dev/payment-qr-preview#public-pay`, wait: 500 },
  { name: "payment-qr-07-public-return", url: `${baseUrl}/dev/payment-qr-preview#public-return`, wait: 500 },
  { name: "payment-qr-08-public-review", url: `${baseUrl}/dev/payment-qr-preview#public-review`, wait: 500 },
  { name: "payment-qr-09-campaign-editor", url: `${baseUrl}/dev/payment-qr-preview#campaign-editor`, wait: 500 },
  { name: "payment-qr-10-analytics", url: `${baseUrl}/dev/payment-qr-preview#analytics`, wait: 500 },
  { name: "payment-qr-public-live", url: `${baseUrl}/dev/pay-preview`, wait: 800 },
  { name: "payment-qr-showcase-full", url: `${baseUrl}/dev/payment-qr-preview`, fullPage: true, wait: 1000 },
];

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

for (const shot of shots) {
  await page.goto(shot.url, { waitUntil: "networkidle" });
  await page.waitForTimeout(shot.wait ?? 500);
  const file = path.join(outDir, `${shot.name}.png`);
  if (shot.fullPage) {
    await page.screenshot({ path: file, fullPage: true });
  } else {
    await page.screenshot({ path: file });
  }
  console.log(`saved ${file}`);
}

await browser.close();
console.log("All payment QR screenshots saved to", outDir);
