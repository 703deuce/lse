import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const outDir = "/opt/cursor/artifacts/screenshots";
const baseUrl = "http://localhost:3000/dev/backlink-gap-preview";

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 60000 });
  await page.waitForTimeout(1500);

  const tabs = [
    { label: "Overview", file: "backlink-gap-overview.png" },
    { label: "Opportunities", file: "backlink-gap-opportunities.png" },
    { label: "Competitor Matrix", file: "backlink-gap-matrix.png" },
    { label: "Ignored / Spam", file: "backlink-gap-ignored.png" },
    { label: "Tasks", file: "backlink-gap-tasks.png" },
  ];

  for (const tab of tabs) {
    await page.getByRole("button", { name: tab.label, exact: true }).click();
    await page.waitForTimeout(1200);
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
