import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const url = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000/dev/reviews-preview";
const outDir = process.env.ARTIFACT_DIR ?? "/opt/cursor/artifacts/screenshots";
const outFile = path.join(outDir, "reviews-page-compact.png");

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.waitForTimeout(1500);
  await page.screenshot({ path: outFile, fullPage: true });
  console.log(`Screenshot saved to ${outFile}`);
} finally {
  await browser.close();
}
