import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.BASE_URL ?? "http://127.0.0.1:3000";
const OUT = process.env.ARTIFACT_DIR ?? "/opt/cursor/artifacts/screenshots/workflow-lifecycle";

const SCREENS = [
  {
    slug: "01-reputation-overview",
    url: "/dev/workflow-overview-reputation",
    wait: "Overview",
  },
  {
    slug: "02-combined-overview",
    url: "/dev/workflow-overview-combined",
    wait: "Local Visibility",
  },
  {
    slug: "03-local-visibility-bridge",
    url: "/dev/workflow-local-visibility",
    wait: "Generate My Local Visibility Report",
  },
  {
    slug: "04-maps-setup-wizard",
    url: "/dev/workflow-maps-setup",
    wait: "Local SEO Wizard",
  },
  {
    slug: "05-maps-overview",
    url: "/dev/workflow-maps-overview",
    wait: "Maps Overview",
  },
  {
    slug: "06-reputation-setup-wizard",
    url: "/dev/workflow-reputation-setup",
    wait: "Reputation setup",
  },
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  channel: "chrome",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});

const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

const results = [];

for (const screen of SCREENS) {
  const url = `${BASE}${screen.url}`;
  console.log("→", url);
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 90_000 });
    if (screen.wait) {
      await page.getByText(screen.wait, { exact: false }).first().waitFor({
        state: "visible",
        timeout: 30_000,
      });
    }
    await page.waitForTimeout(800);
    const file = path.join(OUT, `${screen.slug}.png`);
    await page.screenshot({ path: file, fullPage: true });
    results.push({ slug: screen.slug, file, status: res?.status() ?? 0, ok: true });
    console.log("  OK", file);
  } catch (err) {
    const file = path.join(OUT, `${screen.slug}-error.png`);
    await page.screenshot({ path: file, fullPage: true }).catch(() => null);
    results.push({
      slug: screen.slug,
      file,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    console.error("  FAIL", err);
  }
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
