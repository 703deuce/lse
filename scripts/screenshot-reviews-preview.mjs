import { chromium } from "playwright";
import { mkdir } from "node:fs/promises";
import path from "node:path";

// Dev preview renders the same sidebar + reviews UI without auth/Suspense issues in headless capture.
const url = process.env.PREVIEW_URL ?? "http://127.0.0.1:3000/dev/reviews-preview";
const outDir = process.env.ARTIFACT_DIR ?? "/opt/cursor/artifacts/screenshots";

await mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({
  viewport: { width: 1680, height: 960 },
  deviceScaleFactor: 2,
});

try {
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await page.getByText("Backlink Gap").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("Growth Plan").waitFor({ state: "visible", timeout: 10_000 });
  await page.getByText("AVERAGE RATING").waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForTimeout(500);

  const viewportFile = path.join(outDir, "reviews-page-compact.png");
  await page.screenshot({ path: viewportFile, fullPage: false });
  console.log(`Viewport screenshot saved to ${viewportFile}`);

  const sidebar = page.locator("aside").first();
  if (await sidebar.count()) {
    const sidebarFile = path.join(outDir, "reviews-page-sidebar-full.png");
    await sidebar.screenshot({ path: sidebarFile });
    console.log(`Sidebar screenshot saved to ${sidebarFile}`);
  }

  const stream = page.locator("text=Recent Review Stream").first();
  if (await stream.count()) {
    await stream.scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    const pager = page.getByText(/Showing \d+–\d+ of/).first();
    if (await pager.count()) {
      await pager.scrollIntoViewIfNeeded();
      await page.waitForTimeout(300);
    }
    const streamFile = path.join(outDir, "reviews-page-stream-pagination.png");
    await page.screenshot({ path: streamFile, fullPage: false });
    console.log(`Stream screenshot saved to ${streamFile}`);
  }
} finally {
  await browser.close();
}
