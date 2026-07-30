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
    button: /^Run Full Growth Audit$/i,
    apiPath: "/api/growth-audit/run",
  },
  {
    path: `/businesses/${BUSINESS_ID}/backlink-gap`,
    button: /Run Backlink|Rescan|Run Gap/i,
    apiPath: "/api/backlink-gap/run",
  },
  {
    path: `/businesses/${BUSINESS_ID}/trust`,
    buttons: [
      /Rescan Market/i,
      /Find Local Trust Opportunities/i,
      /Find Local Trust/i,
    ],
    apiPath: "/api/trust/run",
    prep: "trust",
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
    prep: "ai-visibility",
  },
];

function urlFor(p) {
  return p.startsWith("http") ? p : `${BASE}${p.startsWith("/") ? p : `/${p}`}`;
}

async function checkPageLoad(page, check) {
  console.log(`  [PAGE ONLY — not enqueueing a job] ${check.label}`);
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

async function findVisibleRunButton(page, cfg) {
  const patterns = cfg.buttons ?? (cfg.button ? [cfg.button] : []);
  for (const pattern of patterns) {
    const locator = page.getByRole("button", { name: pattern, disabled: false });
    const count = await locator.count();
    if (!count) continue;
    const btn = locator.first();
    if (await btn.isVisible().catch(() => false)) {
      return btn;
    }
  }
  return null;
}

/** Trust hides "Find" when markets exist; Rescan needs a specific market selected. */
async function prepareTrustPage(page) {
  const rescan = page.getByRole("button", { name: /Rescan Market/i }).first();
  if (!(await rescan.count())) return;

  const disabled = await rescan.isDisabled().catch(() => true);
  if (!disabled) return;

  console.log("  [RUN JOB] Trust: select a market so Rescan Market is enabled");
  const marketTrigger = page
    .locator("div")
    .filter({ hasText: /^Market$/ })
    .locator("..")
    .getByRole("button")
    .first();
  await marketTrigger.click({ timeout: 10_000 }).catch(() => {});
  await page.waitForTimeout(400);

  const marketPick = page
    .locator("div.absolute")
    .getByRole("button")
    .filter({ hasText: /,/ })
    .first();
  if (await marketPick.count()) {
    await marketPick.click({ timeout: 10_000 });
    await page.waitForTimeout(800);
  }
}

/** Wait until Run Check is enabled (not already running from a prior enqueue). */
async function prepareAiVisibilityPage(page) {
  const runBtn = page.getByRole("button", { name: /Run Check|Run AI/i }).first();
  if (!(await runBtn.count())) return;

  for (let i = 0; i < 24; i++) {
    if (!(await runBtn.isDisabled().catch(() => true))) return;
    if (i === 0) {
      console.log("  [RUN JOB] AI Visibility: waiting for Run Check to become enabled…");
    }
    await page.waitForTimeout(5000);
  }
}

async function runPagePrep(page, cfg) {
  if (cfg.prep === "trust") await prepareTrustPage(page);
  if (cfg.prep === "ai-visibility") await prepareAiVisibilityPage(page);
}

async function checkRunButton(page, cfg) {
  const entry = {
    label: cfg.path,
    ok: false,
    apiStatus: null,
    apiUrl: null,
    apiBody: null,
    error: null,
    waitedMs: null,
  };

  try {
    console.log(`  [RUN JOB] Open page: ${cfg.path}`);
    await page.goto(urlFor(cfg.path), {
      waitUntil: "domcontentloaded",
      timeout: PAGE_TIMEOUT,
    });
    await page.waitForTimeout(5000);
    await runPagePrep(page, cfg);

    const waitStart = Date.now();
    let btn = await findVisibleRunButton(page, cfg);
    if (!btn) {
      // Module dashboards often load data after first paint.
      for (let i = 0; i < 12 && !btn; i++) {
        await page.waitForTimeout(5000);
        await runPagePrep(page, cfg);
        btn = await findVisibleRunButton(page, cfg);
      }
    }
    if (!btn) {
      const disabledRun = page.getByRole("button", { name: /Run Check|Rescan Market|Find Local Trust/i }).first();
      if ((await disabledRun.count()) && (await disabledRun.isDisabled().catch(() => false))) {
        entry.error = "Run button present but disabled (job running or missing setup)";
        console.log(`  [RUN JOB] FAIL — button disabled`);
        return entry;
      }
      entry.error = "Button not found";
      console.log(`  [RUN JOB] FAIL — no Run button on page after waiting`);
      return entry;
    }

    const btnLabel = ((await btn.innerText().catch(() => "")) || "").trim();
    console.log(
      `  [RUN JOB] Clicking "${btnLabel}" — waiting up to ${RUN_POST_TIMEOUT / 1000}s for POST ${cfg.apiPath}`
    );

    const apiPromise = page.waitForResponse(
      (r) =>
        r.url().includes(cfg.apiPath) &&
        r.request().method() === "POST",
      { timeout: RUN_POST_TIMEOUT }
    );

    await btn.click({ timeout: 60_000 });
    const resp = await apiPromise.catch(() => null);
    entry.waitedMs = Date.now() - waitStart;

    if (!resp) {
      entry.error = `No matching POST within ${RUN_POST_TIMEOUT / 1000}s (waited ${entry.waitedMs}ms after click)`;
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
    console.log(
      `  [RUN JOB] POST ${entry.apiUrl} → HTTP ${entry.apiStatus} (${entry.waitedMs}ms) body=${entry.apiBody?.slice(0, 120) ?? ""}`
    );
    if (!entry.ok) {
      entry.error = entry.apiBody;
    }
  } catch (e) {
    entry.error = e.message?.slice(0, 200);
  }

  return entry;
}

/** Direct API POST (no UI) — same as clicking Run; check Coolify web logs for module_run_* lines. */
async function checkDirectApi(page, { label, url, body }) {
  console.log(`\n[DIRECT API] ${label}`);
  console.log(`  POST ${url}`);
  const r = await page.evaluate(async ({ url, body }) => {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return { status: res.status, body: (await res.text()).slice(0, 500) };
  }, { url, body });
  const ok = r.status < 400;
  console.log(`  → HTTP ${r.status} ${ok ? "OK" : "FAIL"}`);
  console.log(`  → ${r.body}`);
  console.log(`  (Check Coolify WEB app logs for: module_run_start, job_enqueue_start, api_http_error)`);
  return { label, ok, ...r };
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

  console.log("\n=== Page loads (previously broken) ===");
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

  console.log("\n=== Direct API enqueue (no page UI — triggers Coolify web logs) ===");
  const directResults = [];
  const directBody = { businessId: BUSINESS_ID };
  for (const ep of [
    { label: "growth-audit/run", url: `${BASE}/api/growth-audit/run` },
    { label: "backlink-gap/run", url: `${BASE}/api/backlink-gap/run`, body: { ...directBody, forceRefresh: true } },
    { label: "trust/run", url: `${BASE}/api/trust/run` },
    { label: "keywords/check", url: `${BASE}/api/keywords/check` },
    { label: "reputation/sync", url: `${BASE}/api/reputation/sync` },
    { label: "ai-visibility/run", url: `${BASE}/api/ai-visibility/run` },
  ]) {
    directResults.push(
      await checkDirectApi(page, {
        label: ep.label,
        url: ep.url,
        body: ep.body ?? directBody,
      })
    );
  }

  const report = {
    timestamp: new Date().toISOString(),
    base: BASE,
    businessId: BUSINESS_ID,
    summary: {
      directApiTested: directResults.length,
      directApiPassed: directResults.filter((r) => r.ok).length,
      pagesTested: pageResults.length,
      pagesPassed: pageResults.filter((r) => r.ok).length,
      runsTested: runResults.length,
      runsPassed: runResults.filter((r) => r.ok).length,
    },
    directResults,
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
    `Direct API ${report.summary.directApiPassed}/${report.summary.directApiTested}, Pages ${report.summary.pagesPassed}/${report.summary.pagesTested}, UI Runs ${report.summary.runsPassed}/${report.summary.runsTested}`
  );

  await browser.close();

  const allOk =
    report.summary.directApiPassed === report.summary.directApiTested &&
    report.summary.pagesPassed === report.summary.pagesTested &&
    report.summary.runsPassed === report.summary.runsTested;
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
