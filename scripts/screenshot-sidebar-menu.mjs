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
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 2,
});

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByText("Backlink Gap").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByText("Growth Plan").waitFor({ state: "visible", timeout: 15_000 });
  await page.getByText("Reports").first().waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(800);

  // Clip to header + nav only — full aside height is mostly empty navy and looks like a blank blue panel.
  const clip = await page.evaluate(() => {
    const aside = document.querySelector("aside");
    const nav = aside?.querySelector("nav");
    if (!aside || !nav) return null;
    const asideBox = aside.getBoundingClientRect();
    const navBox = nav.getBoundingClientRect();
    return {
      x: asideBox.x,
      y: asideBox.y,
      width: asideBox.width,
      height: Math.ceil(navBox.bottom - asideBox.y + 12),
    };
  });

  const menuFile = path.join(outDir, "reviews-sidebar-menu.png");
  if (clip) {
    await page.screenshot({ path: menuFile, clip });
  } else {
    await page.locator("aside").first().screenshot({ path: menuFile });
  }
  console.log(`Menu screenshot saved to ${menuFile}`);

  const manifestFile = path.join(outDir, "reviews-sidebar-menu.txt");
  await writeFile(manifestFile, menuManifest, "utf8");
  console.log(`Menu manifest saved to ${manifestFile}`);
} finally {
  await browser.close();
}
