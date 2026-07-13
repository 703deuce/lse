import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const outDir = "/opt/cursor/artifacts/screenshots";
const baseUrl = "http://localhost:3000/dev/review-requests-preview";

const tabs = [
  { name: "Review Poster", file: "review-requests-poster.png" },
  { name: "Templates", file: "review-requests-templates.png" },
  { name: "Quick Send", file: "review-requests-send.png" },
  { name: "Bulk Upload", file: "review-requests-bulk.png" },
  { name: "Tracking", file: "review-requests-tracking.png" },
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/local/bin/google-chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Review Requests", { timeout: 60000 });
  await page.waitForTimeout(2500);

  for (const tab of tabs) {
    await page.getByRole("button", { name: tab.name, exact: true }).click();
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: path.join(outDir, tab.file),
      fullPage: true,
    });
    console.log("saved", tab.file);
  }

  await browser.close();
  console.log("Screenshots saved to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
