/** Capture production payment wizard template picker */
import { chromium } from "playwright";
import path from "path";

const OUT = "/opt/cursor/artifacts/screenshots/payment-qr-live";
const URL =
  "https://app.localseoexpress.com/businesses/e64dbadd-69bb-4715-a526-6d137c0ae409/reputation/qr-campaigns/new/payment";

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto(URL, { waitUntil: "domcontentloaded", timeout: 120000 });
await page.waitForTimeout(5000);

const hasNewPicker = await page.getByText("Choose Your Page Template").isVisible();
const hasOldPicker = await page.getByText("Page template").isVisible();
console.log("new picker:", hasNewPicker, "old picker:", hasOldPicker);

if (hasNewPicker) {
  const picker = page.getByText("Choose Your Page Template").locator("xpath=ancestor::div[contains(@class,'space-y-4')]");
  await picker.screenshot({ path: path.join(OUT, "14-prod-template-picker-grid.png") });
}
await page.screenshot({ path: path.join(OUT, "14-prod-wizard-step1.png"), fullPage: false });
await browser.close();
console.log("saved production screenshots");
