import { chromium } from "playwright";
import path from "path";
import fs from "fs";

const outDir = "/opt/cursor/artifacts/screenshots/reputation-mockups";
fs.mkdirSync(outDir, { recursive: true });

const pages = [
  ["overview", "/dev/review-overview-preview"],
  ["feed", "/dev/review-feed-preview"],
  ["analytics", "/dev/review-analytics-preview"],
  ["competitors", "/dev/competitor-intelligence-preview"],
  ["insights", "/dev/review-insights-preview"],
  ["requests", "/dev/review-requests-preview"],
  ["campaigns", "/dev/review-campaigns-preview"],
  ["templates", "/dev/review-templates-preview"],
  ["contacts", "/dev/review-contacts-preview"],
  ["automations", "/dev/review-automations-preview"],
  ["alerts", "/dev/review-alerts-preview"],
  ["audit", "/dev/reputation-audit-preview"],
];

const browser = await chromium.launch({
  executablePath: "/usr/local/bin/google-chrome",
  headless: true,
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const context = await browser.newContext({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});
const page = await context.newPage();

const results = [];
for (const [name, route] of pages) {
  const url = `http://127.0.0.1:3000${route}`;
  try {
    const res = await page.goto(url, { waitUntil: "networkidle", timeout: 90000 });
    await page.waitForTimeout(1200);
    // Prefer full page content screenshot
    const file = path.join(outDir, `reputation-${name}.png`);
    await page.screenshot({ path: file, fullPage: true });
    results.push({ name, status: res?.status() ?? 0, file, ok: true });
    console.log(`OK ${name} ${res?.status()} -> ${file}`);
  } catch (err) {
    results.push({ name, ok: false, error: String(err) });
    console.error(`FAIL ${name}:`, err);
  }
}

await browser.close();
fs.writeFileSync(path.join(outDir, "index.json"), JSON.stringify(results, null, 2));
console.log("DONE", results.filter(r => r.ok).length, "/", results.length);
