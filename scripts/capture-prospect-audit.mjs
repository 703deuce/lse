import { chromium } from "playwright";
import fs from "fs";
import path from "path";
import crypto from "crypto";

const OUT = "/opt/cursor/artifacts/screenshots/mockup-verify/prospect-audit";
const BASE = process.env.CAPTURE_BASE_URL || "http://127.0.0.1:3000";

function md5(file) {
  return crypto.createHash("md5").update(fs.readFileSync(file)).digest("hex");
}

async function shot(page, file, label) {
  const full = path.join(OUT, file);
  await page.screenshot({ path: full, fullPage: false });
  console.log("wrote", full, md5(full), label);
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Setup state
  let url = `${BASE}/dev/prospect-audit-preview?state=setup`;
  console.log("Opening", url);
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Run Prospect Audit", { timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(page, "00-setup.png", "setup");

  // Running state
  url = `${BASE}/dev/prospect-audit-preview?state=running`;
  console.log("Opening", url);
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Running Prospect Audit", { timeout: 60000 });
  await page.waitForTimeout(800);
  await shot(page, "00-running.png", "running");

  // Completed state
  url = `${BASE}/dev/prospect-audit-preview`;
  console.log("Opening", url);
  await page.goto(url, { waitUntil: "networkidle", timeout: 120000 });
  await page.waitForSelector("text=Prospect Audit", { timeout: 60000 });
  await page.waitForTimeout(1500);
  await shot(page, "01-audit-overview.png", "completed overview");

  const full = path.join(OUT, "01-audit-full.png");
  await page.screenshot({ path: full, fullPage: true });
  console.log("wrote", full, md5(full));

  const kw2 = page.getByRole("button", { name: /emergency dentist/i });
  if (await kw2.count()) {
    await kw2.first().click();
    await page.waitForTimeout(500);
    await shot(page, "02-keyword-switch.png", "keyword switch");
  }

  // Sidebar hierarchy on audits list path via static preview (setup page already shows nested nav)
  await shot(page, "03-sidebar-hierarchy.png", "sidebar with nested prospect audits");

  fs.writeFileSync(
    path.join(OUT, "index.json"),
    JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        files: fs.readdirSync(OUT).filter((f) => f.endsWith(".png")),
      },
      null,
      2
    )
  );
  await browser.close();
  console.log("Done →", OUT);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
