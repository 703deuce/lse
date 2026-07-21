import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const outDir = "/opt/cursor/artifacts/screenshots/mockup-verify/reviews";
const baseUrl = "http://localhost:3000/dev/reviews-preview";

const tabs = [
  { label: "Your Reviews", file: "01-your-reviews.png", query: "your-reviews" },
  { label: "Competitor Reviews", file: "02-competitor-reviews.png", query: "competitor-reviews" },
  { label: "Themes & Mentions", file: "03-themes-mentions.png", query: "sentiment" },
  { label: "Unanswered", file: "04-unanswered.png", query: "unanswered" },
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined,
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 980 } });

  for (const tab of tabs) {
    await page.goto(`${baseUrl}?tab=${tab.query}`, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(2500);
    // Prefer clicking the tab button to ensure active state
    const btn = page.getByRole("button", { name: tab.label, exact: true });
    if (await btn.count()) {
      await btn.click();
      await page.waitForTimeout(1200);
    }
    const file = path.join(outDir, tab.file);
    await page.screenshot({ path: file, fullPage: true });
    console.log("saved", file);
  }

  await browser.close();
  console.log("done", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
