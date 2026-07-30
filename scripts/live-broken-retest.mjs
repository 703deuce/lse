/**
 * Retest only routes/APIs that failed in the full live audit.
 * Skips SMS send, A2P completion, and the 74+ pages that already passed.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "https://app.localseoexpress.com";
const OUT_DIR = process.env.AUDIT_OUT ?? "/opt/cursor/artifacts/live-audit";
const BUSINESS_ID =
  process.env.AUDIT_BUSINESS_ID ?? "e64dbadd-69bb-4715-a526-6d137c0ae409";
const PAGE_TIMEOUT = 90_000;
/** Max wait for the Run POST to return (not full job completion). Ends as soon as the API responds. */
const RUN_POST_TIMEOUT = Number(process.env.RUN_POST_TIMEOUT_MS ?? 480_000); // 8 min default

const PAGE_CHECKS = [
  {
    label: "/prospects/audits",
    url: `${BASE}/prospects/audits`,
    badApi: /\/api\/businesses\/audits\//,
  },
  {
    label: "/reputation/automations (webhooks)",
    url: `${BASE}/businesses/${BUSINESS_ID}/reputation/automations`,
    badApi: /\/api\/integrations\/webhooks/,
  },
  {
    label: "/workspace",
    url: `${BASE}/workspace`,
  },
  {
    label: "/competitors",
    url: `${BASE}/businesses/${BUSINESS_ID}/competitors`,
  },
];

const RUN_CHECKS = [
  {
    path: `/businesses/${BUSINESS_ID}/growth-audit`,
    button: /Run.*Audit|Run Audit|Google Business Profile/i,
    apiPath: "/api/growth-audit/run",
  },
  {
    path: `/businesses/${BUSINESS_ID}/backlink-gap`,
    button: /Run Backlink|Rescan|Run Gap/i,
    apiPath: "/api/backlink-gap/run",
  },
  {
    path: `/businesses/${BUSINESS_ID}/trust`,
    button: /Find Local Trust Opportunities|Rescan Market/i,
    apiPath: "/api/trust/run",
  },
  {
    path: `/businesses/${BUSINESS_ID}/keywords`,
    button: /^Run Keyword Check$/i,
    apiPath: "/api/keywords/",
  },
  {
    path: `/businesses/${BUSINESS_ID}/reputation/audit`,
    button: /Run Reputation|Generate|Sync|Refresh/i,
    apiPath: "/api/reputation/sync",
  },
  {
    path: `/businesses/${BUSINESS_ID}/ai-visibility`,
    button: /Run Check|Run AI/i,
    apiPath: "/api/ai-visibility/run",
  },
];

function urlFor(p) {
  return p.startsWith("http") ? p : `${BASE}${p.startsWith("/") ? p : `/${p}`}`;
}

async function checkPageLoad(page, check) {
  const result = {
    label: check.label,
    url: check.url,
    ok: true,
    finalUrl: "",
    httpStatus: null,
    apiFailures: [],
    consoleErrors: [],
    error: null,
  };

  const apiFailures = [];
  const consoleErrors = [];
  const onConsole = (m) => {
    if (m.type() === "error") consoleErrors.push(m.text());
  };
  const onResponse = (res) => {
    const u = res.url();
    if (!u.includes("/api/")) return;
    const status = res.status();
    if (status >= 400) {
      apiFailures.push({ status, url: u.slice(0, 200) });
    }
    if (check.badApi && check.badApi.test(u) && status >= 400) {
      result.ok = false;
    }
  };

  page.on("console", onConsole);
  page.on("response", onResponse);

  try {
    const resp = await page.goto(check.url, {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT,
    });
    await page.waitForTimeout(2500);
    result.finalUrl = page.url();
    result.httpStatus = resp?.status() ?? null;
    if (resp && resp.status() >= 400) {
      result.ok = false;
      result.error = `HTTP ${resp.status()}`;
    }
    if (apiFailures.some((f) => f.status >= 500)) result.ok = false;
    if (check.badApi && apiFailures.some((f) => check.badApi.test(f.url) && f.status >= 400)) {
      result.ok = false;
      result.error = result.error ?? "Expected API still failing";
    }
  } catch (e) {
    result.ok = false;
    result.error = e.message?.slice(0, 300);
  }

  result.apiFailures = apiFailures;
  result.consoleErrors = [...new Set(consoleErrors)].slice(0, 8);
  page.removeListener("console", onConsole);
  page.removeListener("response", onResponse);
  return result;
}

async function checkRunButton(page, cfg) {
  const entry = {
    label: cfg.path,
    ok: false,
    apiStatus: null,
    apiUrl: null,
    apiBody: null,
    error: null,
  };

  try {
    await page.goto(urlFor(cfg.path), {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT,
    });
    await page.waitForTimeout(3000);

    const btn = page.getByRole("button", { name: cfg.button }).first();
    try {
      await btn.waitFor({ state: "visible", timeout: 30_000 });
    } catch {
      entry.error = "Button not found";
      return entry;
    }

    const apiPromise = page.waitForResponse(
      (r) =>
        r.url().includes(cfg.apiPath) &&
        r.request().method() === "POST",
      { timeout: RUN_POST_TIMEOUT }
    );

    await btn.click();
    const resp = await apiPromise.catch(() => null);

    if (!resp) {
      entry.error = `No matching POST within ${RUN_POST_TIMEOUT / 1000}s`;
      return entry;
    }

    entry.apiStatus = resp.status();
    entry.apiUrl = resp.url().slice(0, 160);
    try {
      entry.apiBody = (await resp.text()).slice(0, 400);
    } catch {
      entry.apiBody = null;
    }
    entry.ok = resp.status() < 400;
    if (!entry.ok) {
      entry.error = entry.apiBody;
    }
  } catch (e) {
    entry.error = e.message?.slice(0, 200);
  }

  return entry;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ||
      "/usr/local/bin/google-chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  // Warm session on a business page (prod auth bypass).
  await page.goto(urlFor(`/businesses/${BUSINESS_ID}/overview`), {
    waitUntil: "domcontentloaded",
    timeout: PAGE_TIMEOUT,
  });
  await page.waitForTimeout(1500);

  console.log("=== Page loads (previously broken) ===");
  const pageResults = [];
  for (const check of PAGE_CHECKS) {
    process.stdout.write(`${check.label} ... `);
    const r = await checkPageLoad(page, check);
    pageResults.push(r);
    console.log(r.ok ? "OK" : "FAIL");
  }

  console.log("\n=== Module Run buttons (previously broken) ===");
  const runResults = [];
  for (const cfg of RUN_CHECKS) {
    process.stdout.write(`${cfg.path} ... `);
    const r = await checkRunButton(page, cfg);
    runResults.push(r);
    console.log(r.ok ? "OK" : `FAIL (${r.error ?? r.apiStatus ?? "?"})`);
  }

  const report = {
    timestamp: new Date().toISOString(),
    base: BASE,
    businessId: BUSINESS_ID,
    summary: {
      pagesTested: pageResults.length,
      pagesPassed: pageResults.filter((r) => r.ok).length,
      runsTested: runResults.length,
      runsPassed: runResults.filter((r) => r.ok).length,
    },
    pageResults,
    runResults,
  };

  const jsonPath = path.join(OUT_DIR, "broken-retest-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const md = [
    "# Broken-route retest — app.localseoexpress.com",
    "",
    `Date: ${report.timestamp}`,
    "",
    "## Summary",
    `- Pages: ${report.summary.pagesPassed}/${report.summary.pagesTested} passed`,
    `- Run buttons: ${report.summary.runsPassed}/${report.summary.runsTested} passed`,
    "",
    "## Pages",
    "",
    ...pageResults.map(
      (r) =>
        `- ${r.label}: ${r.ok ? "OK" : "FAIL"} ${r.error ?? ""} ${r.apiFailures
          .filter((f) => f.status >= 500)
          .map((f) => f.status + " " + f.url)
          .join("; ") ?? ""}`
    ),
    "",
    "## Run buttons",
    "",
    ...runResults.map(
      (r) =>
        `- ${r.label}: ${r.ok ? "OK" : "FAIL"} status=${r.apiStatus ?? ""} ${r.error ?? ""}`
    ),
  ].join("\n");

  fs.writeFileSync(path.join(OUT_DIR, "broken-retest-report.md"), md);

  console.log("\nDone.");
  console.log(`JSON: ${jsonPath}`);
  console.log(
    `Pages ${report.summary.pagesPassed}/${report.summary.pagesTested}, Runs ${report.summary.runsPassed}/${report.summary.runsTested}`
  );

  await browser.close();

  const allOk =
    report.summary.pagesPassed === report.summary.pagesTested &&
    report.summary.runsPassed === report.summary.runsTested;
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
