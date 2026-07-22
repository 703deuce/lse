/**
 * Capture Maps Campaigns setup wizard preview for mockup verification.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/maps-campaigns-wizard";
const BASE = process.env.CAPTURE_BASE_URL || "http://127.0.0.1:3000";
const VIEWPORT = { width: 1440, height: 900 };

function md5(file) {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: VIEWPORT });

  const url = `${BASE}/dev/maps-campaigns-wizard-preview`;
  console.log("Opening", url);
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Let’s start with basics", { timeout: 60000 });
  await page.waitForTimeout(1500);

  // Prefill name like mockup
  const input = page.locator('input[placeholder*="Soft Re-Newal"]').first();
  if (await input.count()) {
    await input.fill("Soft Re-Newal Building");
  } else {
    await page.locator("input").first().fill("Soft Re-Newal Building");
  }
  await page.waitForTimeout(400);

  const overview = path.join(OUT, "01-wizard-overview.png");
  await page.screenshot({ path: overview, fullPage: false });
  console.log("wrote", overview, md5(overview));

  const full = path.join(OUT, "01-wizard-full.png");
  await page.screenshot({ path: full, fullPage: true });
  console.log("wrote", full, md5(full));

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
    await page.waitForTimeout(400);
    const file = path.join(
      OUT,
      `01-wizard-scroll-${String(i + 1).padStart(2, "0")}.png`
    );
    await page.screenshot({ path: file, fullPage: false });
    console.log("wrote", file, md5(file));
    y += step;
    i += 1;
    if (y + metrics.clientHeight >= metrics.scrollHeight) break;
  }

  fs.writeFileSync(
    path.join(OUT, "index.json"),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        url,
        files: fs.readdirSync(OUT).filter((f) => f.endsWith(".png")),
      },
      null,
      2
    )
  );

  await browser.close();
  console.log("Done →", OUT);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
