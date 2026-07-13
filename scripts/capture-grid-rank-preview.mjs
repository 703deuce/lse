import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const outDir = "/opt/cursor/artifacts/screenshots";
const baseUrl = "http://localhost:3000/dev/grid-rank-preview";

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 90000 });
  await page.waitForSelector("text=Rank Grid", { timeout: 60000 });
  await page.waitForTimeout(4000);

  await page.screenshot({
    path: path.join(outDir, "grid-rank-overview.png"),
    fullPage: false,
  });

  await page.screenshot({
    path: path.join(outDir, "grid-rank-full.png"),
    fullPage: true,
  });

  await page.getByRole("button", { name: "Compare", exact: true }).click();
  await page.waitForTimeout(3500);
  await page.screenshot({
    path: path.join(outDir, "grid-compare-over-time.png"),
    fullPage: false,
  });

  await page.getByRole("button", { name: "Vs competitor", exact: true }).click();
  await page.waitForTimeout(2500);
  await page.screenshot({
    path: path.join(outDir, "grid-compare-vs-competitor.png"),
    fullPage: false,
  });

  await page.getByRole("button", { name: "New Scan", exact: true }).click();
  await page.waitForTimeout(1000);

  await page.getByRole("button", { name: "Scans hub", exact: true }).click();
  await page.waitForTimeout(1500);
  await page.screenshot({
    path: path.join(outDir, "grid-scans-hub.png"),
    fullPage: true,
  });

  await browser.close();
  console.log("Screenshots saved to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
