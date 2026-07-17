/**
 * Verifies dev preview pages wire Run buttons to the expected module API paths.
 *
 * Usage (dev server on :3000 with DEV_BYPASS from .env.local):
 *   node scripts/verify-module-run-buttons.mjs
 */
import { chromium } from "playwright";

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";

/** @type {Array<{ path: string; button: string | RegExp; apiPath: string; waitFor?: string | RegExp }>} */
const CASES = [
  {
    path: "/dev/review-momentum-preview",
    button: "Run Momentum Audit",
    apiPath: "/api/reviews/momentum/run",
    waitFor: "Run Momentum Audit",
  },
  {
    path: "/dev/local-trust-preview",
    button: /Find Local Trust Opportunities|Rescan Market/,
    apiPath: "/api/trust/run",
    waitFor: "Local Trust",
    beforeClick: async (page) => {
      const rescan = page.getByRole("button", { name: "Rescan Market" });
      if (await rescan.count()) return;
      // Run is hidden when markets exist — pick a market to expose Rescan.
      await page.getByRole("button", { name: /All Service Areas|Woodbridge/ }).first().click();
      await page.getByRole("button", { name: /Woodbridge, VA/ }).click();
      await rescan.waitFor({ state: "visible", timeout: 15_000 });
    },
  },
  {
    path: "/dev/growth-audit-preview",
    button: /Run.*Growth Audit|Run Audit/,
    apiPath: "/api/growth-audit/run",
    waitFor: /Growth Audit|Run Audit/,
  },
  {
    path: "/dev/backlink-gap-preview",
    button: "Run Backlink Gap",
    apiPath: "/api/backlink-gap/run",
    waitFor: "Backlink",
  },
  {
    path: "/dev/keywords-preview",
    button: "Run Keyword Check",
    apiPath: "/api/keywords/check",
    waitFor: "Keyword",
  },
  {
    path: "/dev/grid-rank-preview",
    button: /Run \d+×\d+ scan/,
    apiPath: "/api/scans/run-for-keyword",
    waitFor: /Run \d+×\d+ scan/,
  },
];

async function installFetchRecorder(page) {
  await page.evaluate(() => {
    const posts = [];
    window.__moduleRunPosts = posts;
    const currentFetch = window.fetch.bind(window);
    window.fetch = async (...args) => {
      const [input, init] = args;
      const method = (init?.method ?? "GET").toUpperCase();
      const url = String(input);
      if (method === "POST") {
        posts.push(url);
      }
      return currentFetch(...args);
    };
  });
}

async function readRecordedPosts(page) {
  return page.evaluate(() => window.__moduleRunPosts ?? []);
}

async function verifyCase(page, spec) {
  const url = `${BASE_URL}${spec.path}`;
  console.log(`\n→ ${spec.path}`);

  await page.goto(url, { waitUntil: "networkidle", timeout: 120_000 });

  if (spec.waitFor) {
    await page.getByText(spec.waitFor).first().waitFor({ timeout: 60_000 });
  }

  await installFetchRecorder(page);

  if (spec.beforeClick) {
    await spec.beforeClick(page);
  }

  const postsBefore = await readRecordedPosts(page);
  const button =
    typeof spec.button === "string"
      ? page.getByRole("button", { name: spec.button })
      : page.getByRole("button", { name: spec.button });

  await button.first().waitFor({ state: "visible", timeout: 30_000 });
  await button.first().click();

  // Allow React handlers / fetch to settle.
  await page.waitForTimeout(1500);

  const posts = await readRecordedPosts(page);
  const newPosts = posts.slice(postsBefore.length);
  const matched = newPosts.some((p) => p.includes(spec.apiPath));

  if (!matched) {
    console.error(`  FAIL: expected POST to ${spec.apiPath}`);
    console.error(`  Recorded POSTs: ${JSON.stringify(newPosts)}`);
    throw new Error(`${spec.path}: no POST to ${spec.apiPath}`);
  }

  console.log(`  OK: POST ${spec.apiPath}`);
}

async function main() {
  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/local/bin/google-chrome",
  });

  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  try {
    for (const spec of CASES) {
      await verifyCase(page, spec);
    }
    console.log("\nAll module Run buttons verified.");
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
