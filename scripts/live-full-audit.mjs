/**
 * Full live app audit — https://app.localseoexpress.com (auth bypass on prod).
 * Skips: SMS send, A2P registration completion.
 */
import { chromium } from "playwright";
import fs from "fs";
import path from "path";

const BASE = "https://app.localseoexpress.com";
const OUT_DIR = process.env.AUDIT_OUT ?? "/opt/cursor/artifacts/live-audit";
const BUSINESS_ID = process.env.AUDIT_BUSINESS_ID ?? "e64dbadd-69bb-4715-a526-6d137c0ae409";
const PROSPECT_ID = process.env.AUDIT_PROSPECT_ID ?? "624060b5-9d90-41f0-9443-71de6ca3f433";
const PAGE_TIMEOUT = 90_000;
const RUN_JOB_TIMEOUT = 300_000; // 5 min for run buttons

const SKIP_CLICK =
  /sign out|log out|delete|remove permanently|send sms|send text|text message|submit registration|submit for review|complete registration|register (brand|campaign)|purchase|subscribe now|pay now|confirm payment|charge card/i;

const BUSINESS_PATHS = [
  "overview",
  "scans",
  "campaigns",
  "keywords",
  "growth-audit",
  "local-seo-health",
  "tasks",
  "backlink-gap",
  "trust",
  "ai-visibility",
  "reputation/overview",
  "reputation/requests",
  "reputation/campaigns",
  "reputation/templates",
  "reputation/automations",
  "reputation/contacts",
  "reputation/reviews",
  "reputation/analytics",
  "reputation/competitors",
  "reputation/insights",
  "reputation/audit",
  "reputation/qr-campaigns",
  "reputation/qr-campaigns/plans",
  "reputation/qr-campaigns/new",
  "reputation/qr-campaigns/new/review",
  "reputation/qr-campaigns/new/payment",
  "reputation/alerts",
  "reputation/settings",
  "reputation/messaging",
  "reputation/messaging/number",
  "reputation/messaging/status",
  "reputation/messaging/review",
  "reputation/messaging/use-case",
  "reputation/messaging/business",
  "reports",
  "settings",
  "reviews",
  "review-settings",
  "review-templates",
  "review-campaigns",
  "citations",
  "competitors",
  "competitor-gaps",
  "progress",
  "workspace",
];

const ORG_PATHS = [
  "/onboarding",
  "/settings",
  "/settings/subscription",
  "/branding",
  "/reports",
  "/scans",
  "/businesses",
  "/businesses/new",
  "/workspace",
  "/prospects",
  "/prospects/audits",
  `/prospects/${PROSPECT_ID}`,
  `/prospects/${PROSPECT_ID}/audit`,
  "/clients",
  "/ai-visibility",
  "/tools/google-maps-rank-checker",
  "/tools/google-review-widget",
  "/tools/review-response-generator",
  "/tools/go/dashboard",
  "/tools/go/review-requests",
  "/tools/go/review-overview",
  "/tools/go/maps-scans",
  "/tools/go/growth-audit",
  "/tools/go/backlink-gap",
  "/tools/go/trust",
  "/tools/go/keywords",
  "/tools/go/review-qr",
  "/tools/go/messaging",
  "/tools/go/messaging/number",
  "/tools/go/messaging/status",
  "/reputation/qr-claim",
];

function urlFor(p) {
  if (p.startsWith("http")) return p;
  return `${BASE}${p.startsWith("/") ? p : `/${p}`}`;
}

function isErrorPage(text) {
  return (
    /something went wrong|application error|unhandled runtime error|page not found|this page couldn.?t load/i.test(
      text
    ) && !/404 competitors|not found yet|no contacts yet|no results found/i.test(text)
  );
}

async function collectDynamicUrls(page, businessId) {
  const found = new Set();
  await page.goto(urlFor(`/businesses/${businessId}/scans`), {
    waitUntil: "domcontentloaded",
    timeout: PAGE_TIMEOUT,
  });
  await page.waitForTimeout(2500);
  const hrefs = await page.evaluate(() =>
    [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"))
  );
  for (const h of hrefs) {
    if (!h) continue;
    if (h.includes("/grid/")) found.add(h.split("?")[0]);
    if (h.includes("/reputation/campaigns/") && !h.endsWith("/campaigns"))
      found.add(h.split("?")[0]);
    if (h.includes("/reputation/qr-campaigns/") && !/\/new|\/plans$/.test(h))
      found.add(h.split("?")[0]);
    if (h.includes("/review-campaigns/") && !h.endsWith("/review-campaigns"))
      found.add(h.split("?")[0]);
    if (h.includes("/clients/")) found.add(h.split("?")[0]);
  }
  return [...found];
}

async function auditPageLoad(page, url, label) {
  const result = {
    label,
    url,
    ok: true,
    finalUrl: "",
    httpIssue: null,
    pageErrors: [],
    consoleErrors: [],
    apiFailures: [],
    uiError: null,
    loadMs: 0,
  };

  const pageErrors = [];
  const consoleErrors = [];
  const apiFailures = [];

  const onPageError = (e) => pageErrors.push(e.message);
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
  };

  page.on("pageerror", onPageError);
  page.on("console", onConsole);
  page.on("response", onResponse);

  const start = Date.now();
  try {
    const resp = await page.goto(url, { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    await page.waitForTimeout(2500);
    result.finalUrl = page.url();
    result.loadMs = Date.now() - start;
    if (resp && resp.status() >= 400) {
      result.httpIssue = `HTTP ${resp.status()}`;
      result.ok = false;
    }
    if (result.finalUrl.includes("/sign-in") && !url.includes("/sign-in")) {
      result.uiError = "Redirected to sign-in";
      result.ok = false;
    }
    const bodyText = await page.locator("body").innerText();
    if (isErrorPage(bodyText)) {
      result.uiError = "Error text on page";
      result.ok = false;
    }
  } catch (e) {
    result.ok = false;
    result.uiError = e.message?.slice(0, 300);
    result.loadMs = Date.now() - start;
  }

  result.pageErrors = [...new Set(pageErrors)].slice(0, 10);
  result.consoleErrors = [...new Set(consoleErrors)].slice(0, 10);
  result.apiFailures = apiFailures.slice(0, 15);

  if (result.pageErrors.length) result.ok = false;
  if (result.apiFailures.some((f) => f.status >= 500)) result.ok = false;

  page.removeListener("pageerror", onPageError);
  page.removeListener("console", onConsole);
  page.removeListener("response", onResponse);

  return result;
}

async function clickSafeButtons(page, label) {
  const clicks = [];
  const buttons = page.getByRole("button");
  const count = await buttons.count();
  const max = Math.min(count, 40);

  for (let i = 0; i < max; i++) {
    const btn = buttons.nth(i);
    const name = ((await btn.innerText().catch(() => "")) || "").trim().replace(/\s+/g, " ");
    if (!name || name.length > 80) continue;
    if (SKIP_CLICK.test(name)) {
      clicks.push({ name, skipped: true, reason: "skip pattern" });
      continue;
    }
    if (!await btn.isVisible().catch(() => false)) continue;
    if (!await btn.isEnabled().catch(() => false)) {
      clicks.push({ name, skipped: true, reason: "disabled" });
      continue;
    }

    const isRun = /^(run |rescan|start scan|new scan|refresh|reload)/i.test(name);
    try {
      await btn.click({ timeout: 5000 });
      await page.waitForTimeout(isRun ? 3000 : 800);
      const err = await page
        .locator("text=/something went wrong|failed to|error:/i")
        .first()
        .isVisible()
        .catch(() => false);
      clicks.push({ name, clicked: true, errorAfter: err });
      if (isRun) {
        await page.waitForTimeout(5000);
      }
    } catch (e) {
      clicks.push({ name, clicked: false, error: e.message?.slice(0, 120) });
    }
  }
  return { label, clicks };
}

async function auditNavSidebar(page, businessId) {
  const navResults = [];
  await page.goto(urlFor(`/businesses/${businessId}/overview`), {
    waitUntil: "domcontentloaded",
    timeout: PAGE_TIMEOUT,
  });
  await page.waitForTimeout(2000);

  const suites = ["Local SEO", "Reviews", "Settings"];
  for (const suite of suites) {
    const tab = page.getByRole("tab", { name: suite });
    if (await tab.count()) {
      await tab.click();
      await page.waitForTimeout(500);
    }
    const sectionButtons = page.locator("nav button[aria-expanded]");
    const n = await sectionButtons.count();
    for (let i = 0; i < n; i++) {
      const b = sectionButtons.nth(i);
      const sectionName = ((await b.innerText()) || "").trim();
      try {
        await b.click({ timeout: 3000 });
        await page.waitForTimeout(400);
        const links = page.locator("nav a[href]");
        const linkCount = await links.count();
        navResults.push({ suite, section: sectionName, linksVisible: linkCount, ok: linkCount > 0 });
      } catch (e) {
        navResults.push({ suite, section: sectionName, ok: false, error: e.message });
      }
    }
  }
  return navResults;
}

async function runModuleButtons(page, businessId) {
  const runs = [];
  const pages = [
    {
      path: `/businesses/${businessId}/growth-audit`,
      button: /Run.*Audit|Run Audit|Google Business Profile/i,
      wait: 120_000,
    },
    {
      path: `/businesses/${businessId}/backlink-gap`,
      button: /Run Backlink|Rescan|Run Gap/i,
      wait: 180_000,
    },
    {
      path: `/businesses/${businessId}/trust`,
      button: /Find Local Trust|Rescan Market|Search New Market/i,
      wait: 180_000,
    },
    {
      path: `/businesses/${businessId}/keywords`,
      button: /Run Keyword|Check Keywords/i,
      wait: 120_000,
    },
    {
      path: `/businesses/${businessId}/reputation/audit`,
      button: /Run Reputation|Generate/i,
      wait: 180_000,
    },
    {
      path: `/businesses/${businessId}/ai-visibility`,
      button: /Run Check|Run AI/i,
      wait: 120_000,
    },
  ];

  for (const cfg of pages) {
    const entry = { path: cfg.path, ok: false };
    try {
      await page.goto(urlFor(cfg.path), { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
      await page.waitForTimeout(3000);
      const btn = page.getByRole("button", { name: cfg.button }).first();
      try {
        await btn.waitFor({ state: "visible", timeout: 30_000 });
      } catch {
        entry.error = "Button not found";
        runs.push(entry);
        continue;
      }
      const apiPromise = page.waitForResponse(
        (r) => r.url().includes("/api/") && r.request().method() === "POST",
        { timeout: cfg.wait }
      );
      await btn.click();
      const resp = await apiPromise.catch(() => null);
      if (resp) {
        entry.apiStatus = resp.status();
        entry.apiUrl = resp.url().slice(0, 120);
        entry.ok = resp.status() < 400;
      } else {
        entry.error = "No API response within timeout";
      }
      await page.waitForTimeout(3000);
    } catch (e) {
      entry.error = e.message?.slice(0, 200);
    }
    runs.push(entry);
  }
  return runs;
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH || "/usr/local/bin/google-chrome",
  });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

  console.log("Collecting dynamic URLs...");
  const dynamic = await collectDynamicUrls(page, BUSINESS_ID);

  const allPaths = [
    ...ORG_PATHS,
    ...BUSINESS_PATHS.map((p) => `/businesses/${BUSINESS_ID}/${p}`),
    ...dynamic,
  ];
  const uniqueUrls = [...new Set(allPaths.map((p) => urlFor(p)))];

  console.log(`Auditing ${uniqueUrls.length} URLs...`);
  const pageResults = [];
  for (let i = 0; i < uniqueUrls.length; i++) {
    const url = uniqueUrls[i];
    const label = url.replace(BASE, "");
    process.stdout.write(`[${i + 1}/${uniqueUrls.length}] ${label} ... `);
    const r = await auditPageLoad(page, url, label);
    pageResults.push(r);
    console.log(r.ok ? "OK" : "FAIL");
  }

  console.log("Auditing sidebar navigation...");
  const navResults = await auditNavSidebar(page, BUSINESS_ID);

  console.log("Running module Run buttons (long jobs)...");
  const runResults = await runModuleButtons(page, BUSINESS_ID);

  const interactivePages = [
    `/businesses/${BUSINESS_ID}/reputation/requests`,
    `/businesses/${BUSINESS_ID}/reputation/templates`,
    `/businesses/${BUSINESS_ID}/reputation/automations`,
    `/businesses/${BUSINESS_ID}/reputation/contacts`,
    `/businesses/${BUSINESS_ID}/reputation/campaigns`,
    `/businesses/${BUSINESS_ID}/reputation/qr-campaigns`,
    `/businesses/${BUSINESS_ID}/reputation/messaging/number`,
    `/businesses/${BUSINESS_ID}/settings`,
    `/settings`,
    `/branding`,
  ];

  console.log("Clicking safe buttons on key pages...");
  const clickResults = [];
  for (const p of interactivePages) {
    await page.goto(urlFor(p), { waitUntil: "domcontentloaded", timeout: PAGE_TIMEOUT });
    await page.waitForTimeout(2000);
    clickResults.push(await clickSafeButtons(page, p));
  }

  const report = {
    timestamp: new Date().toISOString(),
    base: BASE,
    businessId: BUSINESS_ID,
    summary: {
      totalPages: pageResults.length,
      passed: pageResults.filter((r) => r.ok).length,
      failed: pageResults.filter((r) => !r.ok).length,
    },
    pageResults,
    navResults,
    runResults,
    clickResults,
  };

  const jsonPath = path.join(OUT_DIR, "audit-report.json");
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));

  const failed = pageResults.filter((r) => !r.ok);
  const md = [
    "# Live App Audit — app.localseoexpress.com",
    "",
    `Date: ${report.timestamp}`,
    `Business: ${BUSINESS_ID}`,
    "",
    "## Summary",
    `- Pages tested: ${report.summary.totalPages}`,
    `- Passed: ${report.summary.passed}`,
    `- Failed: ${report.summary.failed}`,
    "",
    "## Failed pages",
    "",
    ...failed.map(
      (r) =>
        `### ${r.label}\n- URL: ${r.url}\n- Issue: ${r.uiError || r.httpIssue || "errors"}\n- API failures: ${r.apiFailures
          .map((f) => f.status + " " + f.url)
          .join("; ") || "none"}\n- Console: ${r.consoleErrors.join("; ") || "none"}\n- Page errors: ${r.pageErrors.join("; ") || "none"}\n`
    ),
    "",
    "## Module Run buttons",
    "",
    ...runResults.map(
      (r) =>
        `- ${r.path}: ${r.ok ? "OK" : "FAIL"} ${r.apiStatus ?? ""} ${r.error ?? ""}`
    ),
    "",
    "## Navigation accordion",
    "",
    ...navResults.map((n) => `- ${n.suite} / ${n.section}: ${n.ok ? "OK" : "FAIL"}`),
  ].join("\n");

  const mdPath = path.join(OUT_DIR, "audit-report.md");
  fs.writeFileSync(mdPath, md);

  console.log("\nDone.");
  console.log(`JSON: ${jsonPath}`);
  console.log(`MD: ${mdPath}`);
  console.log(`Passed: ${report.summary.passed}/${report.summary.totalPages}`);

  await browser.close();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
