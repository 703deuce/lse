/**
 * Production QR screenshots using real agent login (not Dev User bypass).
 *
 * Requires Coolify env (deployed):
 *   AGENT_SCREENSHOT_SECRET
 *   AGENT_SCREENSHOT_EMAIL
 *
 * And locally / in Cursor secrets:
 *   AGENT_SCREENSHOT_SECRET  (same value)
 *
 * Usage:
 *   AGENT_SCREENSHOT_SECRET=… node scripts/agent-prod-screenshots.mjs
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const OUT = "/opt/cursor/artifacts/screenshots/prod-qr-live";
fs.mkdirSync(OUT, { recursive: true });
const BASE = process.env.APP_URL || "https://app.localseoexpress.com";
const SECRET = process.env.AGENT_SCREENSHOT_SECRET?.trim();
const UUID_RE =
  /\/businesses\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;
const CAMP_RE =
  /\/qr-campaigns\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i;

if (!SECRET || SECRET.length < 32) {
  console.error(
    "Set AGENT_SCREENSHOT_SECRET (32+ chars). Also set AGENT_SCREENSHOT_EMAIL on Coolify and redeploy."
  );
  process.exit(1);
}

async function shot(page, name, fullPage = true) {
  await page.waitForTimeout(1000);
  const file = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: file, fullPage });
  console.log("SHOT", name, page.url());
}

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();
page.setDefaultTimeout(60000);

try {
  const loginUrl = `${BASE}/auth/agent?token=${encodeURIComponent(SECRET)}&next=/clients`;
  await page.goto(loginUrl, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(4000);
  console.log("AFTER_AGENT_LOGIN", page.url());
  await shot(page, "00-logged-in", false);

  // Must NOT be Dev User
  const bodyText = await page.locator("body").innerText();
  if (/Dev User|dev@localhost|Exit dev mode/i.test(bodyText)) {
    console.error(
      "Still seeing Dev User chrome. Confirm AGENT_SCREENSHOT_* is set on Coolify, this branch is deployed, and the secret matches."
    );
  }

  const hrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href]")).map((a) => a.getAttribute("href") || "")
  );
  let businessId = null;
  for (const h of hrefs) {
    const m = h.match(UUID_RE);
    if (m) {
      businessId = m[1];
      break;
    }
  }
  console.log("BUSINESS_ID", businessId);
  if (!businessId) {
    console.error("No business found after agent login");
    process.exit(1);
  }

  const qrBase = `${BASE}/businesses/${businessId}/reputation/qr-campaigns`;

  await page.goto(qrBase, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, "02-qr-campaigns-list");

  await page.goto(`${qrBase}/new`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, "03a-create-step1");

  const cont = page.getByRole("button", { name: /^Continue/i });
  if (await cont.count()) {
    await cont.click();
    await page.waitForTimeout(600);
    await shot(page, "03b-create-step2");
    const nameInput = page.getByPlaceholder("Front desk poster");
    if (await nameInput.count()) {
      await nameInput.fill(`Live Screenshot ${Date.now().toString().slice(-6)}`);
    }
    await cont.click();
    await page.waitForTimeout(600);
    await shot(page, "03c-create-step3");
    await cont.click();
    await page.waitForTimeout(1000);
    await shot(page, "03d-create-step4");
    const createBtn = page.getByRole("button", { name: /Create campaign/i });
    if (await createBtn.count()) {
      await createBtn.click();
      await page.waitForTimeout(4500);
    }
  }

  await page.goto(`${qrBase}/plans`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, "04-qr-plans");

  await page
    .goto(`${BASE}/businesses/${businessId}/reputation`, { waitUntil: "networkidle" })
    .catch(() => {});
  await page.waitForTimeout(2000);
  await shot(page, "06-reputation-overview");

  await page.goto(`${BASE}/reputation/qr-claim`, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "08-qr-claim");

  await page.goto(qrBase, { waitUntil: "networkidle" }).catch(() => {});
  await page.waitForTimeout(1500);
  await shot(page, "02b-qr-campaigns-list-populated");

  const campHrefs = await page.evaluate(() =>
    Array.from(document.querySelectorAll("a[href*='/qr-campaigns/']")).map(
      (a) => a.getAttribute("href") || ""
    )
  );
  let campaignId = null;
  for (const h of campHrefs) {
    const m = h.match(CAMP_RE);
    if (m && !h.includes("/new") && !h.includes("/plans") && !h.includes("/analytics")) {
      campaignId = m[1];
      break;
    }
  }
  console.log("CAMPAIGN_ID", campaignId);

  if (campaignId) {
    await page.goto(`${qrBase}/${campaignId}`, { waitUntil: "networkidle" }).catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, "09-qr-campaign-editor");

    await page
      .goto(`${qrBase}/${campaignId}/analytics`, { waitUntil: "networkidle" })
      .catch(() => {});
    await page.waitForTimeout(2000);
    await shot(page, "10-qr-campaign-analytics");

    const shortCode = await page.evaluate(() => {
      const text = document.body.innerText || "";
      const m = text.match(/\/(?:r|go)\/([A-Za-z0-9_-]{4,12})\b/);
      return m ? m[1] : null;
    });
    if (shortCode) {
      const mobile = await context.newPage();
      await mobile.setViewportSize({ width: 390, height: 844 });
      await mobile.goto(`${BASE}/go/${shortCode}`, { waitUntil: "networkidle" }).catch(() => {});
      await mobile.waitForTimeout(2000);
      await mobile.screenshot({
        path: path.join(OUT, "11-scan-landing-mobile.png"),
        fullPage: true,
      });
      console.log("SHOT 11-scan-landing-mobile", mobile.url());
      await mobile.close();
    }
  }

  console.log("DONE", OUT);
  console.log(fs.readdirSync(OUT).join("\n"));
} finally {
  await browser.close();
}
