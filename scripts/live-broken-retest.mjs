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
    buttons: [/Run Full Growth Audit/i, /Run Growth Audit/i, /^Run Audit$/i],
    apiPath: "/api/growth-audit/run",
    prep: "growth-audit",
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

const WORKFLOW_PAGES = [
  { label: "review requests (send UI)", url: `${BASE}/businesses/${BUSINESS_ID}/reputation/requests` },
  { label: "templates", url: `${BASE}/businesses/${BUSINESS_ID}/reputation/templates` },
  { label: "contacts", url: `${BASE}/businesses/${BUSINESS_ID}/reputation/contacts` },
  { label: "campaigns", url: `${BASE}/businesses/${BUSINESS_ID}/reputation/campaigns` },
  { label: "qr-campaigns", url: `${BASE}/businesses/${BUSINESS_ID}/reputation/qr-campaigns` },
  { label: "qr wizard", url: `${BASE}/businesses/${BUSINESS_ID}/reputation/qr-campaigns/new` },
  { label: "messaging number setup", url: `${BASE}/businesses/${BUSINESS_ID}/reputation/messaging/number` },
  { label: "messaging status", url: `${BASE}/businesses/${BUSINESS_ID}/reputation/messaging/status` },
  { label: "reputation settings", url: `${BASE}/businesses/${BUSINESS_ID}/reputation/settings` },
];

const SKIP_WORKFLOW_CLICK =
  /send sms|send text|text message|submit registration|submit for review|complete registration|register (brand|campaign)/i;

const TEST_EMAIL = process.env.AUDIT_TEST_EMAIL ?? "703deuce@gmail.com";

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

/** Wait until a run button is enabled (prior job finished). */
async function prepareWaitRunButton(page, patterns, logLabel, iterations = 36) {
  for (let i = 0; i < iterations; i++) {
    const btn = await findVisibleRunButton(page, {
      buttons: Array.isArray(patterns) ? patterns : [patterns],
    });
    if (btn) return;
    if (i === 0) {
      console.log(`  [RUN JOB] ${logLabel}: waiting for run button to become enabled…`);
    }
    await page.waitForTimeout(5000);
  }
}

async function runPagePrep(page, cfg) {
  if (cfg.prep === "trust") await prepareTrustPage(page);
  if (cfg.prep === "growth-audit") {
    await prepareWaitRunButton(
      page,
      cfg.buttons ?? [/Run Full Growth Audit/i, /Run Growth Audit/i],
      "Growth Audit",
      48
    );
  }
  if (cfg.prep === "ai-visibility") {
    await prepareWaitRunButton(page, [/Run Check|Run AI/i], "AI Visibility", 24);
  }
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

/** POST test_send for first email template — skips SMS. */
async function testEmailTemplateSend(page, businessId, toEmail) {
  console.log(`\n[EMAIL TEST] template test_send → ${toEmail}`);
  const list = await page.evaluate(async (businessId) => {
    const res = await fetch(`/api/reputation/templates?businessId=${encodeURIComponent(businessId)}`);
    return { status: res.status, body: await res.text() };
  }, businessId);

  if (list.status >= 400) {
    console.log(`  → list templates HTTP ${list.status} FAIL`);
    return { ok: false, error: list.body?.slice(0, 200) };
  }

  let templates;
  try {
    templates = JSON.parse(list.body).templates ?? [];
  } catch {
    return { ok: false, error: "Invalid templates JSON" };
  }

  const emailTpl = templates.find((t) => t.channel === "email" && !t.archived);
  if (!emailTpl) {
    console.log("  → no email template found FAIL");
    return { ok: false, error: "No email template" };
  }

  const send = await page.evaluate(
    async ({ businessId, templateId, toEmail }) => {
      const res = await fetch("/api/reputation/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          businessId,
          action: "test_send",
          templateId,
          toEmail,
          customerName: "Live Audit Test",
        }),
      });
      return { status: res.status, body: (await res.text()).slice(0, 500) };
    },
    { businessId, templateId: emailTpl.id, toEmail }
  );

  const ok = send.status < 400;
  console.log(`  → HTTP ${send.status} ${ok ? "OK" : "FAIL"} template=${emailTpl.name}`);
  console.log(`  → ${send.body}`);
  return { ok, status: send.status, body: send.body, templateId: emailTpl.id, templateName: emailTpl.name };
}

async function clickSafeWorkflowButtons(page, pageLabel) {
  const clicks = [];
  const buttons = page.getByRole("button");
  const count = await buttons.count();
  const max = Math.min(count, 25);

  for (let i = 0; i < max; i++) {
    const btn = buttons.nth(i);
    const name = ((await btn.innerText().catch(() => "")) || "").trim().replace(/\s+/g, " ");
    if (!name || name.length > 80) continue;
    if (SKIP_WORKFLOW_CLICK.test(name)) {
      clicks.push({ name, skipped: true, reason: "SMS/A2P skip" });
      continue;
    }
    if (!(await btn.isVisible().catch(() => false))) continue;
    if (!(await btn.isEnabled().catch(() => false))) {
      clicks.push({ name, skipped: true, reason: "disabled" });
      continue;
    }
    if (!/^(new |create |add |import |save |refresh|preview|duplicate|edit )/i.test(name)) {
      clicks.push({ name, skipped: true, reason: "not a safe setup action" });
      continue;
    }
    try {
      await btn.click({ timeout: 5000 });
      await page.waitForTimeout(1200);
      const err = await page
        .locator("text=/something went wrong|failed to load|application error/i")
        .first()
        .isVisible()
        .catch(() => false);
      clicks.push({ name, clicked: true, errorAfter: err });
    } catch (e) {
      clicks.push({ name, clicked: false, error: e.message?.slice(0, 100) });
    }
  }
  return { page: pageLabel, clicks };
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

  console.log("\n=== Workflow / setup pages (SMS send skipped) ===");
  const workflowResults = [];
  for (const check of WORKFLOW_PAGES) {
    process.stdout.write(`${check.label} ... `);
    const r = await checkPageLoad(page, check);
    workflowResults.push(r);
    console.log(r.ok ? "OK" : "FAIL");
  }

  console.log("\n=== Safe workflow button clicks (no SMS/A2P submit) ===");
  const workflowClicks = [];
  for (const check of WORKFLOW_PAGES.slice(0, 4)) {
    await page.goto(check.url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    await page.waitForTimeout(2000);
    workflowClicks.push(await clickSafeWorkflowButtons(page, check.label));
  }

  const emailResult = await testEmailTemplateSend(page, BUSINESS_ID, TEST_EMAIL);

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
      workflowPagesTested: workflowResults.length,
      workflowPagesPassed: workflowResults.filter((r) => r.ok).length,
      emailTestOk: emailResult.ok,
    },
    directResults,
    pageResults,
    runResults,
    workflowResults,
    workflowClicks,
    emailResult,
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
    `- Workflow pages: ${report.summary.workflowPagesPassed}/${report.summary.workflowPagesTested} passed`,
    `- Email test_send: ${report.summary.emailTestOk ? "OK" : "FAIL"}`,
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
    `Direct API ${report.summary.directApiPassed}/${report.summary.directApiTested}, Pages ${report.summary.pagesPassed}/${report.summary.pagesTested}, UI Runs ${report.summary.runsPassed}/${report.summary.runsTested}, Workflows ${report.summary.workflowPagesPassed}/${report.summary.workflowPagesTested}, Email ${report.summary.emailTestOk ? "OK" : "FAIL"}`
  );

  await browser.close();

  const allOk =
    report.summary.directApiPassed === report.summary.directApiTested &&
    report.summary.pagesPassed === report.summary.pagesTested &&
    report.summary.runsPassed === report.summary.runsTested &&
    report.summary.workflowPagesPassed === report.summary.workflowPagesTested &&
    report.summary.emailTestOk;
  process.exit(allOk ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
