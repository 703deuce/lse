import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const base = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000";
const outDir = process.env.ARTIFACT_DIR ?? "/opt/cursor/artifacts/screenshots/enterprise-audit";

const pages = [
  { slug: "workspace", path: "/workspace" },
  { slug: "prospects", path: "/prospects" },
  { slug: "clients", path: "/clients" },
  { slug: "recent-scans", path: "/scans" },
  { slug: "reports", path: "/reports" },
  { slug: "ai-visibility-org", path: "/ai-visibility" },
  { slug: "onboarding", path: "/onboarding" },
  { slug: "settings", path: "/settings" },
  { slug: "branding", path: "/branding" },
  // Dev previews with mock data (enterprise visual reference surfaces)
  { slug: "dev-overview", path: "/dev/overview-preview" },
  { slug: "dev-reviews", path: "/dev/reviews-preview" },
  { slug: "dev-momentum", path: "/dev/review-momentum-preview" },
  { slug: "dev-review-requests", path: "/dev/review-requests-preview" },
  { slug: "dev-growth-audit", path: "/dev/growth-audit-preview" },
  { slug: "dev-local-trust", path: "/dev/local-trust-preview" },
  { slug: "dev-backlink-gap", path: "/dev/backlink-gap-preview" },
  { slug: "dev-keywords", path: "/dev/keywords-preview" },
  { slug: "dev-grid-rank", path: "/dev/grid-rank-preview" },
  { slug: "dev-dashboard", path: "/dev/dashboard-screenshot" },
  // Location-scoped with preview business id
  { slug: "biz-overview", path: "/businesses/preview/overview" },
  { slug: "biz-scans", path: "/businesses/preview/scans" },
  { slug: "biz-campaigns", path: "/businesses/preview/campaigns" },
  { slug: "biz-growth", path: "/businesses/preview/growth-audit" },
  { slug: "biz-backlink", path: "/businesses/preview/backlink-gap" },
  { slug: "biz-trust", path: "/businesses/preview/trust" },
  { slug: "biz-ai", path: "/businesses/preview/ai-visibility" },
  { slug: "biz-reviews", path: "/businesses/preview/reviews" },
  { slug: "biz-momentum", path: "/businesses/preview/review-momentum" },
  { slug: "biz-requests", path: "/businesses/preview/review-requests" },
  { slug: "biz-contacts", path: "/businesses/preview/contacts" },
  { slug: "biz-templates", path: "/businesses/preview/review-templates" },
  { slug: "biz-triggers", path: "/businesses/preview/integrations" },
  { slug: "biz-review-settings", path: "/businesses/preview/review-settings" },
  { slug: "biz-reports", path: "/businesses/preview/reports" },
];

await mkdir(outDir, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "/usr/local/bin/google-chrome",
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 1100 },
  deviceScaleFactor: 1,
});

const results = [];
for (const entry of pages) {
  const url = `${base}${entry.path}`;
  const file = path.join(outDir, `${entry.slug}.png`);
  try {
    const res = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: file, fullPage: false });
    results.push({
      slug: entry.slug,
      path: entry.path,
      status: res?.status() ?? 0,
      file,
      ok: true,
    });
    console.log(`OK ${entry.slug} ${res?.status()} -> ${file}`);
  } catch (err) {
    results.push({
      slug: entry.slug,
      path: entry.path,
      status: 0,
      file,
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    });
    console.log(`FAIL ${entry.slug}: ${err instanceof Error ? err.message : err}`);
  }
}

await browser.close();
console.log(JSON.stringify(results, null, 2));
