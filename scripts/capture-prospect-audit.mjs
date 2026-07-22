import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/prospect-audit";
const BASE = process.env.CAPTURE_BASE_URL || "http://127.0.0.1:3000";

function md5(file) {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const url = `${BASE}/dev/prospect-audit-preview`;
  console.log("Opening", url);
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Prospect Audit", { timeout: 60000 });
  await page.waitForTimeout(1500);

  const overview = path.join(OUT, "01-audit-overview.png");
  await page.screenshot({ path: overview, fullPage: false });
  console.log("wrote", overview, md5(overview));

  const full = path.join(OUT, "01-audit-full.png");
  await page.screenshot({ path: full, fullPage: true });
  console.log("wrote", full, md5(full));

  // Keyword switch
  const kw2 = page.getByRole("button", { name: /emergency dentist/i });
  if (await kw2.count()) {
    await kw2.first().click();
    await page.waitForTimeout(500);
    const switched = path.join(OUT, "02-keyword-switch.png");
    await page.screenshot({ path: switched, fullPage: false });
    console.log("wrote", switched, md5(switched));
  }

  const metrics = await page.evaluate(() => {
    const el = document.scrollingElement || document.documentElement;
    return {
      scrollHeight: Math.max(el.scrollHeight, document.body?.scrollHeight || 0),
      clientHeight: window.innerHeight,
    };
  });
  const step = Math.max(200, metrics.clientHeight - 80);
  let y = 0;
  let i = 0;
  while (y < metrics.scrollHeight - 20 && i < 8) {
    await page.evaluate((top) => window.scrollTo(0, top), y);
    await page.waitForTimeout(350);
    const file = path.join(OUT, `01-audit-scroll-${String(i + 1).padStart(2, "0")}.png`);
    await page.screenshot({ path: file, fullPage: false });
    console.log("wrote", file, md5(file));
    y += step;
    i += 1;
    if (y + metrics.clientHeight >= metrics.scrollHeight) break;
  }

  fs.writeFileSync(
    path.join(OUT, "index.json"),
    JSON.stringify({ capturedAt: new Date().toISOString(), url, files: fs.readdirSync(OUT).filter((f) => f.endsWith(".png")) }, null, 2)
  );
  await browser.close();
  console.log("Done →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
