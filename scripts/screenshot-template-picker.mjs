/** Screenshot template picker on local dev */
import { chromium } from "playwright";
import path from "path";

const OUT = "/opt/cursor/artifacts/screenshots/payment-qr-live";
const URL =
  "http://127.0.0.1:3000/businesses/preview/reputation/qr-campaigns/new/payment";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForSelector("text=Choose Your Page Template", { timeout: 60000 });
await page.waitForTimeout(3000);

const picker = page.locator("text=Choose Your Page Template").locator("xpath=ancestor::div[contains(@class,'space-y-4')]");
await picker.screenshot({
  path: path.join(OUT, "12-local-template-picker-grid.png"),
});
await page.screenshot({
  path: path.join(OUT, "12-local-template-picker-full.png"),
  fullPage: false,
});
await browser.close();
console.log("saved template picker screenshots");
