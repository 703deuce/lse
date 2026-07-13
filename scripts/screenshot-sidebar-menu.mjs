import { chromium } from "playwright";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const url = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000/dev/reviews-preview";
const outDir = process.env.ARTIFACT_DIR ?? "/opt/cursor/artifacts/screenshots";

const menuManifest = [
  "=== MAIN ===",
  "• Overview",
  "• Rank Grid",
  "• Growth Audit",
  "• Review Momentum™",
  "",
  "=== REPUTATION ===",
  "• Reviews",
  "  • Review Requests",
  "",
  "=== RESEARCH ===",
  "• Backlink Gap",
  "• Local Trust",
  "• Citations",
  "• Keywords",
  "• AI Visibility",
  "• Competitors",
  "",
  "=== REPORTS ===",
  "• Growth Plan",
  "• Reports",
  "",
  "=== FOOTER ===",
  "• Settings",
  "• User menu / Exit dev mode",
].join("\n");

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 320, height: 1200 },
  deviceScaleFactor: 2,
});

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByText("Backlink Gap").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByText("Growth Plan").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByText("Reports").first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(800);

  const sidebar = page.locator("aside").first();
  const menuFile = path.join(outDir, "reviews-sidebar-menu.png");
  await sidebar.screenshot({ path: menuFile });
  console.log(`Menu screenshot saved to ${menuFile}`);

  const manifestFile = path.join(outDir, "reviews-sidebar-menu.txt");
  await writeFile(manifestFile, menuManifest, "utf8");
  console.log(`Menu manifest saved to ${manifestFile}`);
} finally {
  await browser.close();
}
