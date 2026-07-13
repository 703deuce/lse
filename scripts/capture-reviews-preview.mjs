import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const outDir = "/opt/cursor/artifacts/screenshots";
const baseUrl = "http://localhost:3000/dev/reviews-preview";

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(2000);

  await page.screenshot({
    path: path.join(outDir, "reviews-sidebar-nav.png"),
    fullPage: false,
  });

  const tabs = [
    { label: "Overview", file: "reviews-overview.png" },
    { label: "Your Reviews", file: "reviews-your-reviews.png" },
    { label: "Competitor Reviews", file: "reviews-competitor-reviews.png" },
    { label: "Themes & Sentiment", file: "reviews-sentiment.png" },
    { label: "Unanswered", file: "reviews-unanswered.png" },
  ];

  for (const tab of tabs) {
    await page.getByRole("button", { name: tab.label, exact: true }).click();
    await page.waitForTimeout(1500);
    await page.screenshot({
      path: path.join(outDir, tab.file),
      fullPage: true,
    });
  }

  await browser.close();
  console.log("Screenshots saved to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
