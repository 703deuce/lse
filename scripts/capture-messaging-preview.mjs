import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const outDir = "/opt/cursor/artifacts/screenshots";
const baseUrl = "http://localhost:3000/dev/messaging-preview";

const screens = [
  { id: "overview", file: "messaging-01-overview.png" },
  { id: "business", file: "messaging-02-business.png" },
  { id: "use_case", file: "messaging-03-use-case.png" },
  { id: "review", file: "messaging-04-review.png" },
  { id: "status", file: "messaging-05-status.png" },
  { id: "number", file: "messaging-06-number.png" },
  { id: "dashboard", file: "messaging-07-dashboard.png" },
  { id: "admin_list", file: "messaging-08-admin-list.png" },
  { id: "admin_detail", file: "messaging-09-admin-detail.png" },
];

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/local/bin/google-chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });

  await page.goto(baseUrl, { waitUntil: "networkidle", timeout: 180000 });
  await page.waitForSelector("[data-screenshot-nav]", { timeout: 120000 });
  await page.waitForTimeout(1500);

  for (const screen of screens) {
    await page.evaluate(() => {
      document.querySelectorAll("[data-screenshot-nav]").forEach((el) => {
        el.style.display = "";
      });
    });
    await page.locator(`[data-screen="${screen.id}"]`).click();
    await page.waitForSelector(`[data-messaging-screen="${screen.id}"]`, { timeout: 30000 });
    await page.waitForTimeout(1200);
    // Hide preview chrome so screenshots match product UI.
    await page.evaluate(() => {
      document.querySelectorAll("[data-screenshot-nav]").forEach((el) => {
        el.style.display = "none";
      });
    });
    await page.screenshot({
      path: path.join(outDir, screen.file),
      fullPage: true,
    });
    console.log("saved", screen.file);
  }

  await browser.close();
  console.log("Screenshots saved to", outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
