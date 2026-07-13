import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const outDir = "/opt/cursor/artifacts/screenshots";
const baseUrl = "http://localhost:3000/dev/keywords-preview";

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/local/bin/google-chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Maps Keywords", { timeout: 60000 });
  await page.waitForTimeout(2500);

  await page.screenshot({
    path: path.join(outDir, "keywords-page.png"),
    fullPage: true,
  });
  console.log("saved keywords-page.png");

  await page.screenshot({
    path: path.join(outDir, "keywords-page-viewport.png"),
    fullPage: false,
  });
  console.log("saved keywords-page-viewport.png");

  await browser.close();
  console.log("Screenshots saved to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
